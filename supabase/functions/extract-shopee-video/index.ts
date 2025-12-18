import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoInfo {
  videoUrl: string | null;
  videoUrlNoWatermark: string | null;
  title: string | null;
  description: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  hasWatermark: boolean;
  success: boolean;
  error?: string;
}

// Clean caption - remove everything after "|" and HTML entities
function cleanCaption(desc: string): string {
  if (!desc) return '';
  
  return desc
    // Remove everything after the pipe (inclusive)
    .split('|')[0]
    // Remove HTML entities
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ========== LAYER 1: Firecrawl + Afianf (JS rendering) ==========
async function tryAfianfWithFirecrawl(url: string): Promise<{
  videoUrl: string | null;
  title: string | null;
  thumbnailUrl: string | null;
}> {
  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.log('[extract-shopee-video] Firecrawl API key not found, skipping');
      return { videoUrl: null, title: null, thumbnailUrl: null };
    }

    const afianfUrl = `https://afianf.pages.dev/shopee/get/?url=${encodeURIComponent(url)}`;
    console.log('[extract-shopee-video] LAYER 1: Trying Firecrawl + Afianf:', afianfUrl);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: afianfUrl,
        formats: ['html'],
        waitFor: 5000, // Wait for JavaScript to load
      }),
    });

    if (!response.ok) {
      console.log('[extract-shopee-video] Firecrawl returned status:', response.status);
      return { videoUrl: null, title: null, thumbnailUrl: null };
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    console.log('[extract-shopee-video] Firecrawl HTML length:', html.length);
    console.log('[extract-shopee-video] Firecrawl HTML sample:', html.substring(0, 500));

    // Extract video URL from rendered HTML
    const videoPatterns = [
      /<video[^>]+src="([^"]+)"/i,
      /src="(https?:\/\/[^"]*\.mp4[^"]*)"/i,
      /"videoUrl":\s*"([^"]+)"/i,
      /"video_url":\s*"([^"]+)"/i,
      /"downloadUrl":\s*"([^"]+)"/i,
      /href="(https?:\/\/[^"]*\.mp4[^"]*)"\s*download/i,
      /data-video="([^"]+)"/i,
      /"url":\s*"(https?:\/\/[^"]*(?:\.mp4|video)[^"]*)"/i,
    ];

    let videoUrl: string | null = null;
    for (const pattern of videoPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && (match[1].includes('.mp4') || match[1].includes('video'))) {
        videoUrl = match[1];
        console.log('[extract-shopee-video] Firecrawl found video URL:', videoUrl);
        break;
      }
    }

    // Extract title
    const titlePatterns = [
      /<h3[^>]*>([^<]+)<\/h3>/i,
      /<title>([^<]+)<\/title>/i,
      /"title":\s*"([^"]+)"/i,
    ];
    let title: string | null = null;
    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        title = cleanCaption(match[1]);
        if (title) {
          console.log('[extract-shopee-video] Firecrawl found title:', title);
          break;
        }
      }
    }

    // Extract thumbnail
    const thumbPatterns = [
      /<img[^>]+src="(https?:\/\/[^"]+)"[^>]+alt="[^"]*shopee/i,
      /<img[^>]+alt="[^"]*shopee[^"]*"[^>]+src="([^"]+)"/i,
      /"thumbnail":\s*"([^"]+)"/i,
      /"cover":\s*"([^"]+)"/i,
    ];
    let thumbnailUrl: string | null = null;
    for (const pattern of thumbPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && !match[1].includes('favicon') && !match[1].includes('logo')) {
        thumbnailUrl = match[1];
        console.log('[extract-shopee-video] Firecrawl found thumbnail:', thumbnailUrl);
        break;
      }
    }

    return { videoUrl, title, thumbnailUrl };
  } catch (error) {
    console.error('[extract-shopee-video] Firecrawl error:', error);
    return { videoUrl: null, title: null, thumbnailUrl: null };
  }
}

// ========== LAYER 2: Direct Afianf fetch (fallback) ==========
async function tryAfianfDirect(url: string): Promise<{
  videoUrl: string | null;
  title: string | null;
  thumbnailUrl: string | null;
}> {
  try {
    const afianfUrl = `https://afianf.pages.dev/shopee/get/?url=${encodeURIComponent(url)}`;
    console.log('[extract-shopee-video] LAYER 2: Trying Afianf direct:', afianfUrl);
    
    const response = await fetch(afianfUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Referer': 'https://afianf.pages.dev/',
      },
    });

    if (!response.ok) {
      console.log('[extract-shopee-video] Afianf direct returned status:', response.status);
      return { videoUrl: null, title: null, thumbnailUrl: null };
    }

    const html = await response.text();
    console.log('[extract-shopee-video] Afianf direct HTML length:', html.length);

    // Try to extract from pre-rendered content or JSON embedded in HTML
    const videoPatterns = [
      /<video[^>]+src="([^"]+)"/i,
      /src="(https?:\/\/[^"]*\.mp4[^"]*)"/i,
      /"videoUrl":\s*"([^"]+)"/i,
      /"downloadUrl":\s*"([^"]+)"/i,
    ];

    let videoUrl: string | null = null;
    for (const pattern of videoPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        videoUrl = match[1];
        console.log('[extract-shopee-video] Afianf direct found video URL:', videoUrl);
        break;
      }
    }

    const titleMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/i);
    const title = titleMatch ? cleanCaption(titleMatch[1]) : null;

    const thumbMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/i);
    const thumbnailUrl = thumbMatch && !thumbMatch[1].includes('favicon') ? thumbMatch[1] : null;

    return { videoUrl, title, thumbnailUrl };
  } catch (error) {
    console.error('[extract-shopee-video] Afianf direct error:', error);
    return { videoUrl: null, title: null, thumbnailUrl: null };
  }
}

// ========== LAYER 3: CDN URL transformations ==========
function generateCDNVariations(originalUrl: string): string[] {
  if (!originalUrl) return [];
  
  console.log('[extract-shopee-video] LAYER 3: Generating CDN variations for:', originalUrl);
  
  const variations: string[] = [];
  
  // Pattern 1: Extract video ID and try different CDN endpoints
  const videoIdMatch = originalUrl.match(/(br-\d+-[\w-]+(?:\.\d+)*)/);
  if (videoIdMatch) {
    const videoId = videoIdMatch[1];
    variations.push(
      `https://cv.shopee.com.br/file/${videoId}.mp4`,
      `https://cf.shopee.com.br/file/video/${videoId}.mp4`,
      `https://down.vod.susercontent.com/api/v4/${videoId}.mp4`,
    );
  }
  
  // Pattern 2: Remove watermark indicators from URL
  if (originalUrl.includes('down-tx-br.vod')) {
    variations.push(originalUrl.replace('down-tx-br.vod', 'tx-br.vod'));
    variations.push(originalUrl.replace('down-tx-br.vod', 'cv.vod'));
  }
  
  // Pattern 3: Try different path structures
  if (originalUrl.includes('/mms/')) {
    variations.push(originalUrl.replace('/mms/', '/video/'));
    variations.push(originalUrl.replace('/mms/', '/media/'));
  }
  
  // Pattern 4: Remove imgwm/watermark params
  if (originalUrl.includes('@imgwm')) {
    variations.push(originalUrl.split('@imgwm')[0] + '.mp4');
  }
  
  console.log('[extract-shopee-video] Generated', variations.length, 'CDN variations');
  return variations;
}

async function tryCDNVariations(originalUrl: string): Promise<string | null> {
  const variations = generateCDNVariations(originalUrl);
  
  for (const url of variations) {
    try {
      console.log('[extract-shopee-video] Testing CDN variation:', url);
      const response = await fetch(url, { method: 'HEAD' });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('video')) {
          console.log('[extract-shopee-video] CDN variation works:', url);
          return url;
        }
      }
    } catch (e) {
      // Continue to next variation
    }
  }
  
  console.log('[extract-shopee-video] No CDN variations worked');
  return null;
}

// ========== LAYER 4: SVXtract fallback ==========
async function trySVXtract(url: string): Promise<{
  videoUrl: string | null;
  title: string | null;
}> {
  try {
    console.log('[extract-shopee-video] LAYER 4: Trying SVXtract for:', url);
    
    // Try the SVXtract API endpoint
    const apiUrl = `https://svxtract.com/api/extract?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://svxtract.com/',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[extract-shopee-video] SVXtract response:', JSON.stringify(data));
      
      if (data.videoUrl || data.video_url || data.download_url) {
        return {
          videoUrl: data.videoUrl || data.video_url || data.download_url,
          title: data.title || null,
        };
      }
    }

    // Try scraping the web interface
    const webResponse = await fetch(`https://svxtract.com/shopee?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (webResponse.ok) {
      const html = await webResponse.text();
      const videoMatch = html.match(/href="(https?:\/\/[^"]*\.mp4[^"]*)"\s*(?:download|class="download")/i);
      if (videoMatch) {
        console.log('[extract-shopee-video] SVXtract found video in web:', videoMatch[1]);
        return { videoUrl: videoMatch[1], title: null };
      }
    }

    console.log('[extract-shopee-video] SVXtract failed');
    return { videoUrl: null, title: null };
  } catch (error) {
    console.error('[extract-shopee-video] SVXtract error:', error);
    return { videoUrl: null, title: null };
  }
}

// ========== Core functions ==========
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

function decodeUnicode(str: string): string {
  return str
    .replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) => 
      String.fromCharCode(parseInt(m.replace('\\u', ''), 16))
    )
    .replace(/\\/g, '');
}

async function extractVideoFromShopeeVideo(url: string): Promise<VideoInfo> {
  console.log('[extract-shopee-video] Extracting from Shopee Video URL:', url);
  
  const result: VideoInfo = {
    videoUrl: null,
    videoUrlNoWatermark: null,
    title: null,
    description: null,
    creator: null,
    thumbnailUrl: null,
    originalUrl: url,
    hasWatermark: true,
    success: false,
  };

  try {
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

    // Find video URL patterns
    const playUrlPatterns = [
      /"playUrl":\s*"([^"]+)"/gi,
      /"play_url":\s*"([^"]+)"/gi,
      /"video_url":\s*"([^"]+)"/gi,
      /"videoUrl":\s*"([^"]+)"/gi,
      /"url":\s*"(https?:\/\/[^"]*\.mp4[^"]*)"/gi,
      /"download_url":\s*"([^"]+)"/gi,
      /src="(https?:\/\/[^"]*\.mp4[^"]*)"/gi,
      /"(https?:\/\/[^"]*video[^"]*\.mp4[^"]*)"/gi,
      /"(https?:\/\/down[^"]*\.mp4[^"]*)"/gi,
    ];

    for (const pattern of playUrlPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let videoUrl = decodeUnicode(match[1]);
        if (videoUrl.includes('.mp4') || videoUrl.includes('video') || videoUrl.includes('playback')) {
          console.log('[extract-shopee-video] Found video URL:', videoUrl);
          result.videoUrl = videoUrl;
          break;
        }
      }
      if (result.videoUrl) break;
    }

    // Extract title
    const titlePatterns = [
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
      /<meta\s+name="title"\s+content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i,
    ];

    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match) {
        result.title = decodeUnicode(match[1]).trim();
        console.log('[extract-shopee-video] Found title:', result.title);
        break;
      }
    }

    // Extract description and clean it
    const descPatterns = [
      /<meta\s+property="og:description"\s+content="([^"]+)"/i,
      /<meta\s+name="description"\s+content="([^"]+)"/i,
      /"description":\s*"([^"]{10,500})"/i,
      /"caption":\s*"([^"]{10,500})"/i,
    ];

    for (const pattern of descPatterns) {
      const match = html.match(pattern);
      if (match) {
        const rawDesc = decodeUnicode(match[1]).trim();
        result.description = cleanCaption(rawDesc);
        console.log('[extract-shopee-video] Found and cleaned description:', result.description);
        break;
      }
    }

    // Extract thumbnail
    const thumbnailPatterns = [
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
      /"thumbnail(?:Url)?":\s*"([^"]+)"/i,
      /"cover(?:Url)?":\s*"([^"]+)"/i,
    ];

    for (const pattern of thumbnailPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.thumbnailUrl = decodeUnicode(match[1]);
        console.log('[extract-shopee-video] Found thumbnail:', result.thumbnailUrl);
        break;
      }
    }

    // Extract creator
    const creatorPatterns = [
      /"(?:author|creator|username|nickname)":\s*"([^"]+)"/i,
      /<meta\s+name="author"\s+content="([^"]+)"/i,
    ];

    for (const pattern of creatorPatterns) {
      const match = html.match(pattern);
      if (match) {
        result.creator = decodeUnicode(match[1]);
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
  
  // Step 3: Extract video from Shopee page (this gives us the watermarked version)
  let result: VideoInfo;
  
  if (finalUrl.includes('sv.shopee') || finalUrl.includes('share-video')) {
    result = await extractVideoFromShopeeVideo(finalUrl);
  } else {
    const secondRedirect = await followRedirects(finalUrl);
    if (secondRedirect !== finalUrl) {
      const redirUrl2 = extractRedirUrl(secondRedirect);
      result = await extractVideoFromShopeeVideo(redirUrl2 || secondRedirect);
    } else {
      result = await extractVideoFromShopeeVideo(finalUrl);
    }
  }
  
  // ========== Try to get video WITHOUT watermark ==========
  console.log('[extract-shopee-video] === Starting watermark-free extraction ===');
  
  // LAYER 1: Firecrawl + Afianf (best chance - renders JavaScript)
  const firecrawlResult = await tryAfianfWithFirecrawl(url);
  if (firecrawlResult.videoUrl) {
    result.videoUrlNoWatermark = firecrawlResult.videoUrl;
    result.hasWatermark = false;
    console.log('[extract-shopee-video] SUCCESS: Got watermark-free video via Firecrawl + Afianf');
    
    if (firecrawlResult.title && !result.description) {
      result.description = firecrawlResult.title;
    }
    if (firecrawlResult.thumbnailUrl && !result.thumbnailUrl) {
      result.thumbnailUrl = firecrawlResult.thumbnailUrl;
    }
    return result;
  }
  
  // LAYER 2: Direct Afianf fetch (in case pre-rendered content exists)
  const afianfResult = await tryAfianfDirect(url);
  if (afianfResult.videoUrl) {
    result.videoUrlNoWatermark = afianfResult.videoUrl;
    result.hasWatermark = false;
    console.log('[extract-shopee-video] SUCCESS: Got watermark-free video via Afianf direct');
    
    if (afianfResult.title && !result.description) {
      result.description = afianfResult.title;
    }
    return result;
  }
  
  // LAYER 3: CDN URL variations (try alternate CDN endpoints)
  if (result.videoUrl) {
    const cdnUrl = await tryCDNVariations(result.videoUrl);
    if (cdnUrl && cdnUrl !== result.videoUrl) {
      result.videoUrlNoWatermark = cdnUrl;
      result.hasWatermark = false;
      console.log('[extract-shopee-video] SUCCESS: Got watermark-free video via CDN variation');
      return result;
    }
  }
  
  // LAYER 4: SVXtract fallback
  const svxResult = await trySVXtract(url);
  if (svxResult.videoUrl) {
    result.videoUrlNoWatermark = svxResult.videoUrl;
    result.hasWatermark = false;
    console.log('[extract-shopee-video] SUCCESS: Got watermark-free video via SVXtract');
    
    if (svxResult.title && !result.description) {
      result.description = svxResult.title;
    }
    return result;
  }
  
  console.log('[extract-shopee-video] All watermark-free methods failed, returning watermarked version');
  return result;
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
    
    console.log('[extract-shopee-video] Final result:', JSON.stringify(videoInfo));
    
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
