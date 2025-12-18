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
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

function extractRedirUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const redir = urlObj.searchParams.get('redir');
    if (redir) {
      console.log('[extract-shopee-video] Found redir param:', redir);
      return decodeURIComponent(redir);
    }
  } catch (e) {
    console.log('[extract-shopee-video] Failed to parse URL for redir');
  }
  return null;
}

async function extractVideoFromShopeeVideo(url: string): Promise<VideoInfo> {
  console.log('[extract-shopee-video] Extracting from Shopee Video URL:', url);
  
  const result: VideoInfo = {
    videoUrl: null,
    title: null,
    creator: null,
    thumbnailUrl: null,
    originalUrl: url,
    success: false,
  };

  try {
    // Fetch the video page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://shopee.com.br/',
      },
    });

    if (!response.ok) {
      console.error('[extract-shopee-video] Failed to fetch:', response.status);
      result.error = `HTTP ${response.status}`;
      return result;
    }

    const html = await response.text();
    console.log('[extract-shopee-video] HTML length:', html.length);

    // Try to find video URL patterns in the HTML/JSON data
    // Pattern 1: playUrl in JSON
    const playUrlPatterns = [
      /"playUrl":\s*"([^"]+)"/gi,
      /"play_url":\s*"([^"]+)"/gi,
      /"video_url":\s*"([^"]+)"/gi,
      /"videoUrl":\s*"([^"]+)"/gi,
      /"url":\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/gi,
      /"download_url":\s*"([^"]+)"/gi,
      /"hls_url":\s*"([^"]+)"/gi,
      /src="(https?:\/\/[^"]*\.mp4[^"]*)"/gi,
      /"(https?:\/\/[^"]*video[^"]*\.mp4[^"]*)"/gi,
      /"(https?:\/\/[^"]*sv\.shopee[^"]*\.mp4[^"]*)"/gi,
      /"(https?:\/\/cf\.shopee\.com\.br\/[^"]*video[^"]*)"/gi,
    ];

    for (const pattern of playUrlPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let videoUrl = match[1];
        // Decode unicode escapes
        videoUrl = videoUrl.replace(/\\u002F/g, '/').replace(/\\/g, '');
        
        // Validate it looks like a video URL
        if (videoUrl.includes('.mp4') || videoUrl.includes('video') || videoUrl.includes('playback')) {
          console.log('[extract-shopee-video] Found video URL:', videoUrl);
          result.videoUrl = videoUrl;
          break;
        }
      }
      if (result.videoUrl) break;
    }

    // Try to extract from script data/JSON blocks
    const scriptMatches = html.matchAll(/<script[^>]*>([^<]*(?:playUrl|video_url|videoUrl)[^<]*)<\/script>/gi);
    for (const match of scriptMatches) {
      const scriptContent = match[1];
      // Try to find video URL in the script
      const urlMatch = scriptContent.match(/"(?:playUrl|play_url|video_url|videoUrl)":\s*"([^"]+)"/i);
      if (urlMatch) {
        let videoUrl = urlMatch[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
        console.log('[extract-shopee-video] Found video URL in script:', videoUrl);
        result.videoUrl = videoUrl;
        break;
      }
    }

    // Extract title
    const titlePatterns = [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<meta\s+name="title"\s+content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i,
      /"title":\s*"([^"]+)"/i,
      /"desc(?:ription)?":\s*"([^"]{10,200})"/i,
    ];

    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match) {
        result.title = match[1].replace(/\\u[\dA-F]{4}/gi, (m) => 
          String.fromCharCode(parseInt(m.replace('\\u', ''), 16))
        ).trim();
        console.log('[extract-shopee-video] Found title:', result.title);
        break;
      }
    }

    // Extract thumbnail
    const thumbnailPatterns = [
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
      /"thumbnail(?:Url)?":\s*"([^"]+)"/i,
      /"cover(?:Url)?":\s*"([^"]+)"/i,
      /"poster":\s*"([^"]+)"/i,
    ];

    for (const pattern of thumbnailPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.thumbnailUrl = match[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
        console.log('[extract-shopee-video] Found thumbnail:', result.thumbnailUrl);
        break;
      }
    }

    // Extract creator/author
    const creatorPatterns = [
      /"(?:author|creator|username|nickname|nick_name)":\s*"([^"]+)"/i,
      /"user_name":\s*"([^"]+)"/i,
      /<meta\s+name="author"\s+content="([^"]+)"/i,
    ];

    for (const pattern of creatorPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.creator = match[1];
        console.log('[extract-shopee-video] Found creator:', result.creator);
        break;
      }
    }

    result.success = true;

  } catch (error) {
    console.error('[extract-shopee-video] Error:', error);
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

async function extractVideoInfo(url: string): Promise<VideoInfo> {
  console.log('[extract-shopee-video] Processing URL:', url);
  
  // Step 1: Follow initial redirects
  let finalUrl = await followRedirects(url);
  
  // Step 2: Check if it's a universal-link redirect page
  const redirUrl = extractRedirUrl(finalUrl);
  if (redirUrl) {
    console.log('[extract-shopee-video] Following redir to:', redirUrl);
    finalUrl = redirUrl;
  }
  
  // Step 3: If it's sv.shopee.com.br (Shopee Video), extract video
  if (finalUrl.includes('sv.shopee') || finalUrl.includes('share-video')) {
    return await extractVideoFromShopeeVideo(finalUrl);
  }
  
  // Step 4: Try to follow one more redirect level
  const secondRedirect = await followRedirects(finalUrl);
  if (secondRedirect !== finalUrl) {
    const redirUrl2 = extractRedirUrl(secondRedirect);
    if (redirUrl2) {
      return await extractVideoFromShopeeVideo(redirUrl2);
    }
    return await extractVideoFromShopeeVideo(secondRedirect);
  }
  
  // Fallback: try to extract from whatever page we have
  return await extractVideoFromShopeeVideo(finalUrl);
}

serve(async (req) => {
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

    console.log('[extract-shopee-video] Starting extraction for:', url);
    
    const videoInfo = await extractVideoInfo(url);
    
    console.log('[extract-shopee-video] Result:', JSON.stringify(videoInfo));
    
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
