import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoInfo {
  videoUrl: string | null;
  title: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  success: boolean;
  error?: string;
}

async function followRedirects(url: string): Promise<string> {
  console.log('[extract-shopee-video] Following redirects for:', url);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    const finalUrl = response.url;
    console.log('[extract-shopee-video] Final URL after redirects:', finalUrl);
    return finalUrl;
  } catch (error) {
    console.error('[extract-shopee-video] Error following redirects:', error);
    return url;
  }
}

async function extractVideoInfo(url: string): Promise<VideoInfo> {
  console.log('[extract-shopee-video] Extracting video info from:', url);
  
  const result: VideoInfo = {
    videoUrl: null,
    title: null,
    creator: null,
    thumbnailUrl: null,
    originalUrl: url,
    success: false,
  };
  
  try {
    // First, follow redirects to get the final URL
    const finalUrl = await followRedirects(url);
    result.originalUrl = finalUrl;
    
    // Fetch the page HTML
    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    
    if (!response.ok) {
      console.error('[extract-shopee-video] Failed to fetch page:', response.status);
      result.error = `Failed to fetch page: ${response.status}`;
      return result;
    }
    
    const html = await response.text();
    console.log('[extract-shopee-video] HTML length:', html.length);
    
    // Try to extract video URL from various sources
    // Pattern 1: Direct video URL in meta tags
    const ogVideoMatch = html.match(/<meta\s+property="og:video(?::url)?"\s+content="([^"]+)"/i);
    if (ogVideoMatch) {
      result.videoUrl = ogVideoMatch[1];
      console.log('[extract-shopee-video] Found video URL from og:video:', result.videoUrl);
    }
    
    // Pattern 2: Video URL in JSON data
    const videoUrlMatch = html.match(/"video_url":\s*"([^"]+)"/i) || 
                          html.match(/"videoUrl":\s*"([^"]+)"/i) ||
                          html.match(/"playUrl":\s*"([^"]+)"/i) ||
                          html.match(/"play_url":\s*"([^"]+)"/i);
    if (videoUrlMatch && !result.videoUrl) {
      result.videoUrl = videoUrlMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
      console.log('[extract-shopee-video] Found video URL from JSON:', result.videoUrl);
    }
    
    // Pattern 3: video/mp4 source
    const mp4Match = html.match(/src="([^"]+\.mp4[^"]*)"/i) ||
                     html.match(/"([^"]+\.mp4[^"]*)"/);
    if (mp4Match && !result.videoUrl) {
      result.videoUrl = mp4Match[1];
      console.log('[extract-shopee-video] Found mp4 URL:', result.videoUrl);
    }
    
    // Extract title
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                       html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.title = titleMatch[1].replace(/\s*[-|].*$/, '').trim();
      console.log('[extract-shopee-video] Found title:', result.title);
    }
    
    // Try to extract from JSON-LD or script data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.name && !result.title) result.title = jsonLd.name;
        if (jsonLd.contentUrl && !result.videoUrl) result.videoUrl = jsonLd.contentUrl;
        if (jsonLd.thumbnailUrl) result.thumbnailUrl = jsonLd.thumbnailUrl;
        if (jsonLd.author?.name) result.creator = jsonLd.author.name;
      } catch (e) {
        console.log('[extract-shopee-video] Failed to parse JSON-LD');
      }
    }
    
    // Extract thumbnail
    const thumbnailMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                           html.match(/"thumbnail(?:Url)?":\s*"([^"]+)"/i) ||
                           html.match(/"cover(?:Url)?":\s*"([^"]+)"/i);
    if (thumbnailMatch && !result.thumbnailUrl) {
      result.thumbnailUrl = thumbnailMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
      console.log('[extract-shopee-video] Found thumbnail:', result.thumbnailUrl);
    }
    
    // Extract creator/author
    const creatorMatch = html.match(/"(?:author|creator|username|nick(?:name)?)":\s*"([^"]+)"/i) ||
                         html.match(/<meta\s+name="author"\s+content="([^"]+)"/i);
    if (creatorMatch && !result.creator) {
      result.creator = creatorMatch[1];
      console.log('[extract-shopee-video] Found creator:', result.creator);
    }
    
    result.success = true;
    
  } catch (error) {
    console.error('[extract-shopee-video] Error extracting video info:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-shopee-video] Processing URL:', url);
    
    const videoInfo = await extractVideoInfo(url);
    
    return new Response(
      JSON.stringify(videoInfo),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-shopee-video] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
