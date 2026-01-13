import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==================== MP4 ATOM PARSER (Zero-Out Approach) ====================

interface AtomInfo {
  type: string;
  offset: number;
  size: number;
}

// Read 4 bytes as big-endian uint32
function readUint32BE(data: Uint8Array, offset: number): number {
  return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
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

// Find moov internal atoms
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

// Check for AI/C2PA markers in data
function containsAIMarkers(data: Uint8Array, start: number, end: number): boolean {
  const markers = [
    [0x63, 0x32, 0x70, 0x61], // 'c2pa'
    [0x6A, 0x75, 0x6D, 0x62], // 'jumb'
    [0x73, 0x6F, 0x72, 0x61], // 'sora'
    [0x6F, 0x70, 0x65, 0x6E], // 'open' (OpenAI)
  ];
  
  for (let i = start; i < Math.min(end - 4, start + 500); i++) {
    for (const marker of markers) {
      if (data[i] === marker[0] && data[i+1] === marker[1] && 
          data[i+2] === marker[2] && data[i+3] === marker[3]) {
        return true;
      }
    }
  }
  return false;
}

// Zero out content of an atom (preserving header structure)
function zeroOutAtomContent(data: Uint8Array, atom: AtomInfo): void {
  // Keep the 8-byte header (size + type), zero out the rest
  const contentStart = atom.offset + 8;
  const contentEnd = atom.offset + atom.size;
  
  for (let i = contentStart; i < contentEnd; i++) {
    data[i] = 0x00;
  }
}

// Zero out specific patterns within data range
function zeroOutPatterns(data: Uint8Array, start: number, end: number): number {
  let cleaned = 0;
  const patterns = [
    // C2PA signatures
    [0x63, 0x32, 0x70, 0x61], // 'c2pa'
    [0x6A, 0x75, 0x6D, 0x62], // 'jumb'
    // AI tool signatures
    [0x73, 0x6F, 0x72, 0x61], // 'sora'
    [0x6F, 0x70, 0x65, 0x6E, 0x61, 0x69], // 'openai'
    // Software identifiers
    [0x53, 0x6F, 0x72, 0x61], // 'Sora'
    [0x4F, 0x70, 0x65, 0x6E, 0x41, 0x49], // 'OpenAI'
  ];
  
  for (let i = start; i < end - 6; i++) {
    for (const pattern of patterns) {
      let match = true;
      for (let j = 0; j < pattern.length && i + j < end; j++) {
        if (data[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        // Zero out the pattern
        for (let j = 0; j < pattern.length && i + j < end; j++) {
          data[i + j] = 0x00;
        }
        cleaned++;
      }
    }
  }
  
  return cleaned;
}

// Process MP4: Zero-out approach (preserves file structure and offsets)
function processMP4Safe(data: Uint8Array): Uint8Array {
  // Create a copy to modify
  const output = new Uint8Array(data);
  
  const atoms = findAtoms(output);
  console.log('[process-video-metadata] Found atoms:', atoms.map(a => `${a.type}(${a.size})`).join(', '));

  let totalCleaned = 0;

  for (const atom of atoms) {
    // Zero-out uuid atoms (typically contain C2PA/JUMBF)
    if (atom.type === 'uuid') {
      console.log('[process-video-metadata] Zeroing uuid atom at offset', atom.offset);
      zeroOutAtomContent(output, atom);
      totalCleaned++;
      continue;
    }

    // Process moov atom - zero-out metadata in udta
    if (atom.type === 'moov') {
      const moovChildren = findMoovChildren(output, atom);
      
      for (const child of moovChildren) {
        if (child.type === 'udta') {
          console.log('[process-video-metadata] Zeroing udta metadata at offset', child.offset);
          // Zero out the entire udta content
          zeroOutAtomContent(output, child);
          totalCleaned++;
        }
        
        // Also check for meta atoms at moov level
        if (child.type === 'meta') {
          // Scan and zero out AI patterns within meta
          const cleaned = zeroOutPatterns(output, child.offset + 8, child.offset + child.size);
          if (cleaned > 0) {
            console.log('[process-video-metadata] Zeroed', cleaned, 'patterns in meta atom');
            totalCleaned += cleaned;
          }
        }
      }
    }

    // Check free/skip atoms for hidden data
    if (atom.type === 'free' || atom.type === 'skip') {
      if (containsAIMarkers(output, atom.offset, atom.offset + atom.size)) {
        console.log('[process-video-metadata] Zeroing suspicious', atom.type, 'atom');
        zeroOutAtomContent(output, atom);
        totalCleaned++;
      }
    }
  }

  // Final pass: zero out any remaining AI-related strings in the file header area
  // Only scan first 10KB to avoid corrupting video data
  const headerScanEnd = Math.min(10240, output.length);
  const headerCleaned = zeroOutPatterns(output, 0, headerScanEnd);
  if (headerCleaned > 0) {
    console.log('[process-video-metadata] Zeroed', headerCleaned, 'patterns in header area');
    totalCleaned += headerCleaned;
  }

  console.log('[process-video-metadata] Total atoms/patterns cleaned:', totalCleaned);
  console.log('[process-video-metadata] Output size (unchanged):', output.length);
  
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

    console.log('[process-video-metadata] Processing video with zero-out approach...');

    let videoData: Uint8Array;
    
    if (videoBase64) {
      // Decode base64 in chunks to avoid stack overflow
      const binaryString = atob(videoBase64);
      videoData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        videoData[i] = binaryString.charCodeAt(i);
      }
      console.log('[process-video-metadata] Decoded base64, size:', videoData.length);
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
      console.log('[process-video-metadata] Fetched video, size:', videoData.length);
    }

    // Validate MP4 signature
    const ftyp = String.fromCharCode(videoData[4], videoData[5], videoData[6], videoData[7]);
    if (ftyp !== 'ftyp') {
      console.warn('[process-video-metadata] Warning: File may not be a valid MP4 (no ftyp at offset 4)');
    }

    // Process the video with zero-out approach (preserves structure)
    const processedVideo = processMP4Safe(videoData);

    // Verify output is same size (zero-out should never change size)
    if (processedVideo.length !== videoData.length) {
      console.error('[process-video-metadata] ERROR: Size mismatch! Input:', videoData.length, 'Output:', processedVideo.length);
      throw new Error('Processing error: size mismatch');
    }

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
        originalSize: videoData.length,
        processedSize: processedVideo.length,
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