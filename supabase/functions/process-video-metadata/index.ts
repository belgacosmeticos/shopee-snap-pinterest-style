import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// iPhone 16 Pro Max metadata to inject
function getIPhoneMetadata(): Record<string, string> {
  const now = new Date();
  const creationDate = now.toISOString().replace('Z', '+0000');
  
  return {
    'com.apple.quicktime.make': 'Apple',
    'com.apple.quicktime.model': 'iPhone 16 Pro Max',
    'com.apple.quicktime.software': '18.4.1',
    'com.apple.quicktime.creationdate': creationDate,
    'creation_time': now.toISOString(),
    'major_brand': 'qt  ',
    'compatible_brands': 'qt  ',
    'encoder': '',
  };
}

// Process video using FFmpeg via external API
async function processVideoWithFFmpeg(videoBase64: string): Promise<string | null> {
  const falApiKey = Deno.env.get('FAL_API_KEY');
  
  if (!falApiKey) {
    console.log('[process-video-metadata] FAL_API_KEY not set, using fallback');
    return null;
  }

  try {
    // For now, we'll use a simple approach - re-encode with metadata stripped
    // In production, you'd want to use a proper FFmpeg API service
    console.log('[process-video-metadata] Processing with external FFmpeg API...');
    
    // Since we can't run FFmpeg directly in Deno, we'll use a client-side approach
    // The edge function will prepare the metadata injection instructions
    return null;
  } catch (error) {
    console.error('[process-video-metadata] FFmpeg processing error:', error);
    return null;
  }
}

// Remove metadata using pure JavaScript/binary manipulation
function stripAndInjectMetadata(videoBuffer: ArrayBuffer): ArrayBuffer {
  const uint8Array = new Uint8Array(videoBuffer);
  
  // MP4 files are structured with "atoms" (or "boxes")
  // We need to find and modify the moov/udta atoms
  // This is a simplified approach - for full C2PA removal, we'd need FFmpeg
  
  // For now, we'll return the original buffer
  // The real processing will happen client-side or via external service
  console.log('[process-video-metadata] Video size:', uint8Array.length, 'bytes');
  
  return videoBuffer;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    let videoBuffer: ArrayBuffer;
    
    if (videoBase64) {
      // Decode base64 video
      const binaryString = atob(videoBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      videoBuffer = bytes.buffer;
    } else {
      // Fetch video from URL
      console.log('[process-video-metadata] Fetching video from:', videoUrl);
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1',
        },
      });
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`);
      }
      
      videoBuffer = await videoResponse.arrayBuffer();
    }

    console.log('[process-video-metadata] Video fetched, size:', videoBuffer.byteLength);

    // Get iPhone metadata
    const iphoneMetadata = getIPhoneMetadata();
    
    // Try FFmpeg processing first
    const processedBase64 = await processVideoWithFFmpeg(
      btoa(String.fromCharCode(...new Uint8Array(videoBuffer)))
    );
    
    if (processedBase64) {
      // FFmpeg processing succeeded
      const binaryString = atob(processedBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return new Response(bytes.buffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="sora-iphone.mp4"',
          'X-Metadata-Injected': 'true',
          'X-Device-Model': 'iPhone 16 Pro Max',
        },
      });
    }
    
    // Fallback: Return video with metadata instructions for client-side processing
    // The client will need to handle the actual metadata injection
    console.log('[process-video-metadata] Returning video with metadata instructions');
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: false,
        message: 'Video ready for client-side metadata injection',
        metadata: iphoneMetadata,
        videoBase64: btoa(String.fromCharCode(...new Uint8Array(videoBuffer.slice(0, 50000000)))), // Limit to 50MB
        videoSize: videoBuffer.byteLength,
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
