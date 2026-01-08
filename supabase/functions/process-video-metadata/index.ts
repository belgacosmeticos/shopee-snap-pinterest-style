import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== MP4 ATOM PARSER ====================

interface MP4Atom {
  type: string;
  offset: number;
  size: number;
  data: Uint8Array;
  children?: MP4Atom[];
}

// Read 4 bytes as big-endian uint32
function readUint32BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

// Write 4 bytes as big-endian uint32
function writeUint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ]);
}

// Read atom type as string
function readAtomType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
}

// Parse MP4 atoms at a given level
function parseAtoms(data: Uint8Array, start: number, end: number): MP4Atom[] {
  const atoms: MP4Atom[] = [];
  let offset = start;

  while (offset < end - 8) {
    const size = readUint32BE(data, offset);
    const type = readAtomType(data, offset + 4);

    if (size < 8 || offset + size > end) {
      break;
    }

    const atomData = data.slice(offset, offset + size);
    const atom: MP4Atom = {
      type,
      offset,
      size,
      data: atomData,
    };

    // Parse container atoms recursively
    if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta'].includes(type)) {
      const headerSize = type === 'meta' ? 12 : 8; // meta has version/flags
      if (size > headerSize) {
        atom.children = parseAtoms(atomData, headerSize, size);
      }
    }

    atoms.push(atom);
    offset += size;
  }

  return atoms;
}

// Check if atom contains C2PA/JUMBF signature
function isC2PAAtom(atom: MP4Atom): boolean {
  if (atom.type !== 'uuid') return false;
  
  // JUMBF UUID: 6A756D62-0011-0010-8000-00AA00389B71
  // C2PA signature patterns
  const jumbfSignature = new Uint8Array([0x6A, 0x75, 0x6D, 0x62]);
  const c2paMarkers = ['c2pa', 'jumb', 'jumd', 'c2ma'];
  
  // Check for JUMBF signature at offset 8
  const uuidStart = atom.data.slice(8, 24);
  const hasJumbf = uuidStart.slice(0, 4).every((b, i) => b === jumbfSignature[i]);
  
  // Check for C2PA markers in content
  const content = new TextDecoder('latin1').decode(atom.data);
  const hasC2PA = c2paMarkers.some(marker => content.toLowerCase().includes(marker));
  
  return hasJumbf || hasC2PA;
}

// Check if atom contains AI/encoder metadata to remove
function isAIMetadataAtom(atom: MP4Atom): boolean {
  const content = new TextDecoder('latin1').decode(atom.data);
  const aiMarkers = [
    'lavf', 'lavc', 'ffmpeg', 'sora', 'openai', 
    'dall-e', 'midjourney', 'stable diffusion',
    'ai generated', 'artificial intelligence'
  ];
  return aiMarkers.some(marker => content.toLowerCase().includes(marker));
}

// Create Apple QuickTime metadata atom (udta)
function createAppleUdtaAtom(): Uint8Array {
  const now = new Date();
  const creationDate = now.toISOString().replace('Z', '-0300');
  
  // Create metadata items
  const items: { key: string; value: string }[] = [
    { key: '©mak', value: 'Apple' },
    { key: '©mod', value: 'iPhone 16 Pro Max' },
    { key: '©swr', value: '18.4.1' },
    { key: '©day', value: creationDate },
    { key: '©xyz', value: '-23.5505-46.6333/' }, // São Paulo coordinates as example
  ];

  // Build ilst atoms
  const ilistItems: Uint8Array[] = [];
  
  for (const item of items) {
    // data atom: size(4) + 'data'(4) + type(4) + locale(4) + value
    const valueBytes = new TextEncoder().encode(item.value);
    const dataSize = 16 + valueBytes.length;
    const dataAtom = new Uint8Array(dataSize);
    
    // data atom header
    dataAtom.set(writeUint32BE(dataSize), 0);
    dataAtom.set(new TextEncoder().encode('data'), 4);
    dataAtom.set(writeUint32BE(1), 8); // type: UTF-8
    dataAtom.set(writeUint32BE(0), 12); // locale
    dataAtom.set(valueBytes, 16);
    
    // item atom: size(4) + key(4) + data atom
    const itemSize = 8 + dataSize;
    const itemAtom = new Uint8Array(itemSize);
    itemAtom.set(writeUint32BE(itemSize), 0);
    itemAtom.set(new TextEncoder().encode(item.key), 4);
    itemAtom.set(dataAtom, 8);
    
    ilistItems.push(itemAtom);
  }

  // Calculate total ilst size
  const ilistContentSize = ilistItems.reduce((sum, item) => sum + item.length, 0);
  const ilistSize = 8 + ilistContentSize;
  
  // Build ilst atom
  const ilistAtom = new Uint8Array(ilistSize);
  ilistAtom.set(writeUint32BE(ilistSize), 0);
  ilistAtom.set(new TextEncoder().encode('ilst'), 4);
  
  let ilistOffset = 8;
  for (const item of ilistItems) {
    ilistAtom.set(item, ilistOffset);
    ilistOffset += item.length;
  }

  // Build hdlr atom for meta
  const hdlrData = new Uint8Array([
    0, 0, 0, 33, // size: 33 bytes
    0x68, 0x64, 0x6C, 0x72, // 'hdlr'
    0, 0, 0, 0, // version/flags
    0, 0, 0, 0, // pre_defined
    0x6D, 0x64, 0x69, 0x72, // 'mdir' - metadata handler
    0x61, 0x70, 0x70, 0x6C, // 'appl' - Apple
    0, 0, 0, 0, // reserved
    0, 0, 0, 0, // reserved
    0 // null terminator
  ]);

  // Build meta atom
  const metaSize = 12 + hdlrData.length + ilistSize; // 12 = size(4) + type(4) + version(4)
  const metaAtom = new Uint8Array(metaSize);
  metaAtom.set(writeUint32BE(metaSize), 0);
  metaAtom.set(new TextEncoder().encode('meta'), 4);
  metaAtom.set(writeUint32BE(0), 8); // version/flags
  metaAtom.set(hdlrData, 12);
  metaAtom.set(ilistAtom, 12 + hdlrData.length);

  // Build udta atom
  const udtaSize = 8 + metaSize;
  const udtaAtom = new Uint8Array(udtaSize);
  udtaAtom.set(writeUint32BE(udtaSize), 0);
  udtaAtom.set(new TextEncoder().encode('udta'), 4);
  udtaAtom.set(metaAtom, 8);

  return udtaAtom;
}

// Rebuild moov atom with cleaned metadata
function rebuildMoovAtom(originalMoov: MP4Atom): Uint8Array {
  if (!originalMoov.children) {
    return originalMoov.data;
  }

  // Filter out old udta and rebuild
  const cleanedChildren: Uint8Array[] = [];
  
  for (const child of originalMoov.children) {
    // Skip old udta - we'll add our own
    if (child.type === 'udta') {
      continue;
    }
    
    // Recursively clean trak atoms
    if (child.type === 'trak' && child.children) {
      const cleanedTrak = rebuildTrakAtom(child);
      cleanedChildren.push(cleanedTrak);
    } else {
      cleanedChildren.push(child.data);
    }
  }

  // Add new Apple udta
  const newUdta = createAppleUdtaAtom();
  cleanedChildren.push(newUdta);

  // Calculate new moov size
  const childrenSize = cleanedChildren.reduce((sum, c) => sum + c.length, 0);
  const moovSize = 8 + childrenSize;

  // Build new moov
  const newMoov = new Uint8Array(moovSize);
  newMoov.set(writeUint32BE(moovSize), 0);
  newMoov.set(new TextEncoder().encode('moov'), 4);

  let offset = 8;
  for (const child of cleanedChildren) {
    newMoov.set(child, offset);
    offset += child.length;
  }

  return newMoov;
}

// Rebuild trak atom, cleaning mdia/minf metadata
function rebuildTrakAtom(trak: MP4Atom): Uint8Array {
  if (!trak.children) {
    return trak.data;
  }

  const cleanedChildren: Uint8Array[] = [];

  for (const child of trak.children) {
    // Skip udta in trak
    if (child.type === 'udta') {
      continue;
    }
    cleanedChildren.push(child.data);
  }

  const childrenSize = cleanedChildren.reduce((sum, c) => sum + c.length, 0);
  const trakSize = 8 + childrenSize;

  const newTrak = new Uint8Array(trakSize);
  newTrak.set(writeUint32BE(trakSize), 0);
  newTrak.set(new TextEncoder().encode('trak'), 4);

  let offset = 8;
  for (const child of cleanedChildren) {
    newTrak.set(child, offset);
    offset += child.length;
  }

  return newTrak;
}

// Main function: Clean MP4 metadata and inject iPhone metadata
function processMP4Metadata(videoData: Uint8Array): Uint8Array {
  console.log('[process-video-metadata] Starting MP4 processing, size:', videoData.length);

  // Parse top-level atoms
  const atoms = parseAtoms(videoData, 0, videoData.length);
  console.log('[process-video-metadata] Found atoms:', atoms.map(a => a.type).join(', '));

  // Filter and rebuild atoms
  const outputAtoms: Uint8Array[] = [];
  let removedC2PA = false;
  let removedAI = false;

  for (const atom of atoms) {
    // Remove C2PA/JUMBF atoms
    if (isC2PAAtom(atom)) {
      console.log('[process-video-metadata] Removing C2PA/JUMBF atom');
      removedC2PA = true;
      continue;
    }

    // Check for AI metadata in uuid atoms
    if (atom.type === 'uuid' && isAIMetadataAtom(atom)) {
      console.log('[process-video-metadata] Removing AI metadata uuid atom');
      removedAI = true;
      continue;
    }

    // Rebuild moov with cleaned metadata
    if (atom.type === 'moov') {
      console.log('[process-video-metadata] Rebuilding moov with iPhone metadata');
      const newMoov = rebuildMoovAtom(atom);
      outputAtoms.push(newMoov);
      continue;
    }

    // Keep other atoms as-is (ftyp, mdat, free, etc.)
    outputAtoms.push(atom.data);
  }

  console.log('[process-video-metadata] Removed C2PA:', removedC2PA, 'Removed AI:', removedAI);

  // Combine all atoms
  const totalSize = outputAtoms.reduce((sum, a) => sum + a.length, 0);
  const output = new Uint8Array(totalSize);
  
  let offset = 0;
  for (const atomData of outputAtoms) {
    output.set(atomData, offset);
    offset += atomData.length;
  }

  console.log('[process-video-metadata] Output size:', output.length);
  return output;
}

// ==================== EDGE FUNCTION ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, videoBase64 } = await req.json();
    
    if (!videoUrl && !videoBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'videoUrl or videoBase64 required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-video-metadata] Processing video...');

    let videoData: Uint8Array;
    
    if (videoBase64) {
      const binaryString = atob(videoBase64);
      videoData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        videoData[i] = binaryString.charCodeAt(i);
      }
    } else {
      console.log('[process-video-metadata] Fetching video from:', videoUrl);
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15',
        },
      });
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }
      
      const buffer = await videoResponse.arrayBuffer();
      videoData = new Uint8Array(buffer);
    }

    console.log('[process-video-metadata] Video fetched, size:', videoData.length);

    // Verify it's an MP4 (check ftyp)
    const ftyp = String.fromCharCode(videoData[4], videoData[5], videoData[6], videoData[7]);
    if (ftyp !== 'ftyp') {
      console.log('[process-video-metadata] Warning: Not a standard MP4, ftyp not at start');
    }

    // Process the video
    const processedVideo = processMP4Metadata(videoData);

    // Convert to base64 for JSON response (more reliable than binary)
    const base64 = btoa(String.fromCharCode(...processedVideo));

    return new Response(
      JSON.stringify({
        success: true,
        processed: true,
        videoBase64: base64,
        deviceModel: 'iPhone 16 Pro Max',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[process-video-metadata] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
