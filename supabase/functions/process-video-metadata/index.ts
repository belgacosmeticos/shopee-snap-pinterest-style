import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== MP4 ATOM PARSER (Lightweight) ====================

interface AtomInfo {
  type: string;
  offset: number;
  size: number;
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

// Find all top-level atoms without copying data
function findAtoms(data: Uint8Array): AtomInfo[] {
  const atoms: AtomInfo[] = [];
  let offset = 0;

  while (offset < data.length - 8) {
    const size = readUint32BE(data, offset);
    const type = readAtomType(data, offset + 4);

    if (size < 8 || offset + size > data.length) {
      break;
    }

    atoms.push({ type, offset, size });
    offset += size;
  }

  return atoms;
}

// Check if atom contains C2PA/JUMBF signature (minimal check)
function isC2PAAtom(data: Uint8Array, atom: AtomInfo): boolean {
  if (atom.type !== 'uuid') return false;
  
  // JUMBF signature check at offset 8-12
  const jumbf = [0x6A, 0x75, 0x6D, 0x62]; // 'jumb'
  const start = atom.offset + 8;
  if (start + 4 <= data.length) {
    if (data[start] === jumbf[0] && data[start + 1] === jumbf[1] && 
        data[start + 2] === jumbf[2] && data[start + 3] === jumbf[3]) {
      return true;
    }
  }
  
  // Quick scan for c2pa marker (check first 200 bytes only)
  const scanEnd = Math.min(atom.offset + 200, atom.offset + atom.size);
  for (let i = atom.offset + 8; i < scanEnd - 4; i++) {
    if (data[i] === 0x63 && data[i+1] === 0x32 && data[i+2] === 0x70 && data[i+3] === 0x61) {
      return true; // 'c2pa'
    }
  }
  
  return false;
}

// Create minimal Apple QuickTime udta atom
function createAppleUdtaAtom(): Uint8Array {
  const now = new Date();
  const creationDate = now.toISOString().replace('Z', '-0300');
  
  // Simplified: just create basic metadata
  const items: { key: string; value: string }[] = [
    { key: '©mak', value: 'Apple' },
    { key: '©mod', value: 'iPhone 16 Pro Max' },
    { key: '©swr', value: '18.4.1' },
    { key: '©day', value: creationDate },
  ];

  const ilistItems: Uint8Array[] = [];
  
  for (const item of items) {
    const valueBytes = new TextEncoder().encode(item.value);
    const dataSize = 16 + valueBytes.length;
    const dataAtom = new Uint8Array(dataSize);
    
    dataAtom.set(writeUint32BE(dataSize), 0);
    dataAtom.set(new TextEncoder().encode('data'), 4);
    dataAtom.set(writeUint32BE(1), 8);
    dataAtom.set(writeUint32BE(0), 12);
    dataAtom.set(valueBytes, 16);
    
    const itemSize = 8 + dataSize;
    const itemAtom = new Uint8Array(itemSize);
    itemAtom.set(writeUint32BE(itemSize), 0);
    itemAtom.set(new TextEncoder().encode(item.key), 4);
    itemAtom.set(dataAtom, 8);
    
    ilistItems.push(itemAtom);
  }

  const ilistContentSize = ilistItems.reduce((sum, item) => sum + item.length, 0);
  const ilistSize = 8 + ilistContentSize;
  
  const ilistAtom = new Uint8Array(ilistSize);
  ilistAtom.set(writeUint32BE(ilistSize), 0);
  ilistAtom.set(new TextEncoder().encode('ilst'), 4);
  
  let ilistOffset = 8;
  for (const item of ilistItems) {
    ilistAtom.set(item, ilistOffset);
    ilistOffset += item.length;
  }

  // hdlr atom
  const hdlrAtom = new Uint8Array([
    0, 0, 0, 33,
    0x68, 0x64, 0x6C, 0x72, // hdlr
    0, 0, 0, 0,
    0, 0, 0, 0,
    0x6D, 0x64, 0x69, 0x72, // mdir
    0x61, 0x70, 0x70, 0x6C, // appl
    0, 0, 0, 0,
    0, 0, 0, 0,
    0
  ]);

  const metaSize = 12 + hdlrAtom.length + ilistSize;
  const metaAtom = new Uint8Array(metaSize);
  metaAtom.set(writeUint32BE(metaSize), 0);
  metaAtom.set(new TextEncoder().encode('meta'), 4);
  metaAtom.set(writeUint32BE(0), 8);
  metaAtom.set(hdlrAtom, 12);
  metaAtom.set(ilistAtom, 12 + hdlrAtom.length);

  const udtaSize = 8 + metaSize;
  const udtaAtom = new Uint8Array(udtaSize);
  udtaAtom.set(writeUint32BE(udtaSize), 0);
  udtaAtom.set(new TextEncoder().encode('udta'), 4);
  udtaAtom.set(metaAtom, 8);

  return udtaAtom;
}

// Find moov internal atoms to locate/remove udta
function findMoovChildren(data: Uint8Array, moovAtom: AtomInfo): AtomInfo[] {
  const children: AtomInfo[] = [];
  let offset = moovAtom.offset + 8;
  const end = moovAtom.offset + moovAtom.size;

  while (offset < end - 8) {
    const size = readUint32BE(data, offset);
    const type = readAtomType(data, offset + 4);

    if (size < 8 || offset + size > end) break;

    children.push({ type, offset, size });
    offset += size;
  }

  return children;
}

// Process MP4: Remove C2PA, rebuild moov with new udta
function processMP4(data: Uint8Array): Uint8Array {
  const atoms = findAtoms(data);
  console.log('[process-video-metadata] Found atoms:', atoms.map(a => a.type).join(', '));

  const chunks: Uint8Array[] = [];
  let moovProcessed = false;

  for (const atom of atoms) {
    // Skip C2PA/JUMBF atoms
    if (isC2PAAtom(data, atom)) {
      console.log('[process-video-metadata] Removing C2PA atom');
      continue;
    }

    // Skip uuid atoms that might contain AI metadata
    if (atom.type === 'uuid') {
      console.log('[process-video-metadata] Removing uuid atom');
      continue;
    }

    // Process moov - remove old udta, add new one
    if (atom.type === 'moov') {
      console.log('[process-video-metadata] Processing moov atom');
      const moovChildren = findMoovChildren(data, atom);
      
      // Build new moov
      const childChunks: Uint8Array[] = [];
      
      for (const child of moovChildren) {
        if (child.type === 'udta') {
          console.log('[process-video-metadata] Removing old udta');
          continue; // Skip old udta
        }
        childChunks.push(data.subarray(child.offset, child.offset + child.size));
      }
      
      // Add new Apple udta
      const newUdta = createAppleUdtaAtom();
      childChunks.push(newUdta);
      
      // Calculate new moov size
      const childrenSize = childChunks.reduce((sum, c) => sum + c.length, 0);
      const newMoovSize = 8 + childrenSize;
      
      // Build moov header
      const moovHeader = new Uint8Array(8);
      moovHeader.set(writeUint32BE(newMoovSize), 0);
      moovHeader.set(new TextEncoder().encode('moov'), 4);
      
      chunks.push(moovHeader);
      for (const child of childChunks) {
        chunks.push(child);
      }
      
      moovProcessed = true;
      continue;
    }

    // Keep other atoms as-is (ftyp, mdat, free, etc.)
    chunks.push(data.subarray(atom.offset, atom.offset + atom.size));
  }

  console.log('[process-video-metadata] Moov processed:', moovProcessed);

  // Combine chunks efficiently
  const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
  const output = new Uint8Array(totalSize);
  
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
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
      // Decode base64 in chunks to avoid stack overflow
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

    // Process the video
    const processedVideo = processMP4(videoData);

    // Use Deno's base64 encoder (handles large arrays properly)
    // Convert to base64 in chunks to avoid stack overflow
    const chunkSize = 32768;
    let base64 = '';
    for (let i = 0; i < processedVideo.length; i += chunkSize) {
      const chunk = processedVideo.subarray(i, Math.min(i + chunkSize, processedVideo.length));
      base64 += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64 = btoa(base64);

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
