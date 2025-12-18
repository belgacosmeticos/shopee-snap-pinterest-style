import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SoraVideoInfo {
  videoUrl: string | null;
  videoUrlNoWatermark: string | null;
  title: string | null;
  prompt: string | null;
  thumbnailUrl: string | null;
  creator: string | null;
  originalUrl: string;
  hasWatermark: boolean;
  success: boolean;
  error?: string;
  method?: string;
}

// ============= LAYER 1: CDN Direto (dyysy.com) =============
// Baseado no SoraPure - CDN alternativo gratuito
async function tryCdnDirect(videoId: string): Promise<string | null> {
  const cdnUrls = [
    `https://oscdn2.dyysy.com/MP4/${videoId}.mp4`,
    `https://oscdn.dyysy.com/MP4/${videoId}.mp4`,
  ];

  for (const cdnUrl of cdnUrls) {
    try {
      console.log('[extract-sora-video] LAYER 1 - Trying CDN direct:', cdnUrl);
      
      const response = await fetch(cdnUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        
        console.log('[extract-sora-video] CDN direct success:', cdnUrl, 'size:', contentLength);
        
        // Verify it's actually a video
        if (contentType?.includes('video') || (contentLength && parseInt(contentLength) > 100000)) {
          return cdnUrl;
        }
      }
    } catch (error) {
      console.log('[extract-sora-video] CDN direct failed:', cdnUrl, error);
    }
  }

  return null;
}

// ============= LAYER 2: CDN Proxy (workers.dev) =============
// Proxy do SoraPure via Cloudflare Workers
async function tryCdnProxy(videoId: string, originalUrl: string): Promise<string | null> {
  const proxyUrls = [
    `https://api.soracdn.workers.dev/download-proxy?url=${encodeURIComponent(originalUrl)}`,
    `https://api.soracdn.workers.dev/video/${videoId}`,
  ];

  for (const proxyUrl of proxyUrls) {
    try {
      console.log('[extract-sora-video] LAYER 2 - Trying CDN proxy:', proxyUrl);
      
      const response = await fetch(proxyUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        
        console.log('[extract-sora-video] CDN proxy success:', proxyUrl);
        
        if (contentType?.includes('video') || (contentLength && parseInt(contentLength) > 100000)) {
          return proxyUrl;
        }
      }
    } catch (error) {
      console.log('[extract-sora-video] CDN proxy failed:', proxyUrl, error);
    }
  }

  return null;
}

// ============= LAYER 3: OpenAI CDN =============
// CDN oficial da OpenAI (pode ter watermark)
async function tryOpenAiCdn(videoId: string): Promise<string | null> {
  const openAiUrls = [
    `https://cdn.openai.com/sora/videos/${videoId}.mp4`,
    `https://cdn.openai.com/MP4/${videoId}.mp4`,
    `https://videos.openai.com/${videoId}.mp4`,
  ];

  for (const cdnUrl of openAiUrls) {
    try {
      console.log('[extract-sora-video] LAYER 3 - Trying OpenAI CDN:', cdnUrl);
      
      const response = await fetch(cdnUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        console.log('[extract-sora-video] OpenAI CDN success:', cdnUrl);
        return cdnUrl;
      }
    } catch (error) {
      console.log('[extract-sora-video] OpenAI CDN failed:', cdnUrl, error);
    }
  }

  return null;
}

// ============= LAYER 4: Firecrawl (último recurso) =============
async function tryFirecrawl(url: string): Promise<SoraVideoInfo | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('[extract-sora-video] LAYER 4 - Firecrawl API key not found');
    return null;
  }

  try {
    console.log('[extract-sora-video] LAYER 4 - Trying Firecrawl for:', url);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['html'],
        waitFor: 5000,
      }),
    });

    if (!response.ok) {
      console.log('[extract-sora-video] Firecrawl returned status:', response.status);
      return null;
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    console.log('[extract-sora-video] Firecrawl HTML length:', html.length);
    
    return extractFromHtml(html, url);
  } catch (error) {
    console.error('[extract-sora-video] Firecrawl error:', error);
    return null;
  }
}

// ============= Extração de Video ID =============
function extractVideoId(url: string): string | null {
  // Padrões de URL do Sora:
  // https://sora.chatgpt.com/p/s_abc123
  // https://sora.chatgpt.com/video/s_abc123
  // https://sora.com/p/s_abc123
  
  const patterns = [
    /\/p\/(s_[a-zA-Z0-9_-]+)/i,
    /\/video\/(s_[a-zA-Z0-9_-]+)/i,
    /\/(s_[a-zA-Z0-9_-]+)(?:\/|$)/i,
    /[?&]id=(s_[a-zA-Z0-9_-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log('[extract-sora-video] Extracted video ID:', match[1]);
      return match[1];
    }
  }

  // Tentar extrair qualquer ID que pareça ser um ID de vídeo
  const genericMatch = url.match(/([a-zA-Z0-9_-]{10,})/);
  if (genericMatch) {
    console.log('[extract-sora-video] Extracted generic ID:', genericMatch[1]);
    return genericMatch[1];
  }

  console.log('[extract-sora-video] Could not extract video ID from:', url);
  return null;
}

// Direct fetch extraction (backup)
async function tryDirectFetch(url: string): Promise<SoraVideoInfo | null> {
  try {
    console.log('[extract-sora-video] LAYER 5 - Trying direct fetch for:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      console.log('[extract-sora-video] Direct fetch returned status:', response.status);
      return null;
    }

    const html = await response.text();
    console.log('[extract-sora-video] Direct fetch HTML length:', html.length);
    
    return extractFromHtml(html, url);
  } catch (error) {
    console.error('[extract-sora-video] Direct fetch error:', error);
    return null;
  }
}

// Extract video info from HTML
function extractFromHtml(html: string, originalUrl: string): SoraVideoInfo | null {
  const result: SoraVideoInfo = {
    videoUrl: null,
    videoUrlNoWatermark: null,
    title: null,
    prompt: null,
    thumbnailUrl: null,
    creator: null,
    originalUrl: originalUrl,
    hasWatermark: true,
    success: false,
    method: 'html-scraping',
  };

  // Video URL patterns
  const videoPatterns = [
    /"videoUrl":\s*"([^"]+)"/i,
    /"video_url":\s*"([^"]+)"/i,
    /"mp4Url":\s*"([^"]+)"/i,
    /"downloadUrl":\s*"([^"]+)"/i,
    /src="(https?:\/\/[^"]*\.mp4[^"]*)"/i,
    /"url":\s*"(https?:\/\/[^"]*(?:\.mp4|video|blob)[^"]*)"/i,
    /data-video-url="([^"]+)"/i,
    /<video[^>]+src="([^"]+)"/i,
    /"playbackUrl":\s*"([^"]+)"/i,
    /"streamUrl":\s*"([^"]+)"/i,
  ];

  for (const pattern of videoPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result.videoUrl = decodeUnicode(match[1]);
      console.log('[extract-sora-video] Found video URL:', result.videoUrl);
      break;
    }
  }

  // Prompt patterns
  const promptPatterns = [
    /"prompt":\s*"([^"]+)"/i,
    /"text":\s*"([^"]{20,})"/i,
    /"description":\s*"([^"]{20,})"/i,
    /data-prompt="([^"]+)"/i,
    /"input":\s*"([^"]+)"/i,
  ];

  for (const pattern of promptPatterns) {
    const match = html.match(pattern);
    if (match && match[1] && match[1].length > 10) {
      result.prompt = decodeUnicode(match[1]).trim();
      console.log('[extract-sora-video] Found prompt:', result.prompt.substring(0, 100));
      break;
    }
  }

  // Title patterns
  const titlePatterns = [
    /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    /<title>([^<]+)<\/title>/i,
    /"title":\s*"([^"]+)"/i,
    /"name":\s*"([^"]+)"/i,
  ];

  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result.title = decodeUnicode(match[1]).trim();
      console.log('[extract-sora-video] Found title:', result.title);
      break;
    }
  }

  // Thumbnail patterns
  const thumbnailPatterns = [
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    /"thumbnail":\s*"([^"]+)"/i,
    /"posterUrl":\s*"([^"]+)"/i,
    /"cover":\s*"([^"]+)"/i,
    /"image":\s*"(https?:\/\/[^"]+)"/i,
  ];

  for (const pattern of thumbnailPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result.thumbnailUrl = decodeUnicode(match[1]);
      console.log('[extract-sora-video] Found thumbnail:', result.thumbnailUrl);
      break;
    }
  }

  // Creator patterns
  const creatorPatterns = [
    /"username":\s*"([^"]+)"/i,
    /"creator":\s*"([^"]+)"/i,
    /"author":\s*"([^"]+)"/i,
    /"user":\s*\{[^}]*"name":\s*"([^"]+)"/i,
  ];

  for (const pattern of creatorPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      result.creator = decodeUnicode(match[1]);
      console.log('[extract-sora-video] Found creator:', result.creator);
      break;
    }
  }

  result.success = !!result.videoUrl;
  return result;
}

function decodeUnicode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) => 
      String.fromCharCode(parseInt(m.replace('\\u', ''), 16))
    )
    .replace(/\\/g, '');
}

// ============= Main Extraction Function =============
async function extractSoraVideo(url: string): Promise<SoraVideoInfo> {
  console.log('[extract-sora-video] Processing URL:', url);
  
  // Extrair o video ID do URL
  const videoId = extractVideoId(url);
  
  if (videoId) {
    // ============= LAYER 1: CDN Direto (dyysy.com) - GRÁTIS =============
    console.log('[extract-sora-video] ========== LAYER 1: CDN Direct ==========');
    const cdnDirectUrl = await tryCdnDirect(videoId);
    if (cdnDirectUrl) {
      console.log('[extract-sora-video] SUCCESS via LAYER 1 (CDN Direct - FREE)');
      return {
        videoUrl: cdnDirectUrl,
        videoUrlNoWatermark: cdnDirectUrl,
        title: `Sora Video - ${videoId}`,
        prompt: null,
        thumbnailUrl: null,
        creator: null,
        originalUrl: url,
        hasWatermark: false,
        success: true,
        method: 'cdn-direct-dyysy',
      };
    }

    // ============= LAYER 2: CDN Proxy (workers.dev) - GRÁTIS =============
    console.log('[extract-sora-video] ========== LAYER 2: CDN Proxy ==========');
    const cdnProxyUrl = await tryCdnProxy(videoId, url);
    if (cdnProxyUrl) {
      console.log('[extract-sora-video] SUCCESS via LAYER 2 (CDN Proxy - FREE)');
      return {
        videoUrl: cdnProxyUrl,
        videoUrlNoWatermark: cdnProxyUrl,
        title: `Sora Video - ${videoId}`,
        prompt: null,
        thumbnailUrl: null,
        creator: null,
        originalUrl: url,
        hasWatermark: false,
        success: true,
        method: 'cdn-proxy-workers',
      };
    }

    // ============= LAYER 3: OpenAI CDN - GRÁTIS (pode ter watermark) =============
    console.log('[extract-sora-video] ========== LAYER 3: OpenAI CDN ==========');
    const openAiCdnUrl = await tryOpenAiCdn(videoId);
    if (openAiCdnUrl) {
      console.log('[extract-sora-video] SUCCESS via LAYER 3 (OpenAI CDN - FREE)');
      return {
        videoUrl: openAiCdnUrl,
        videoUrlNoWatermark: openAiCdnUrl,
        title: `Sora Video - ${videoId}`,
        prompt: null,
        thumbnailUrl: null,
        creator: null,
        originalUrl: url,
        hasWatermark: true, // OpenAI CDN pode ter watermark
        success: true,
        method: 'cdn-openai',
      };
    }
  }
  
  // ============= LAYER 4: Firecrawl (pago) =============
  console.log('[extract-sora-video] ========== LAYER 4: Firecrawl ==========');
  const firecrawlResult = await tryFirecrawl(url);
  if (firecrawlResult && firecrawlResult.videoUrl) {
    console.log('[extract-sora-video] SUCCESS via LAYER 4 (Firecrawl - PAID)');
    firecrawlResult.method = 'firecrawl';
    return firecrawlResult;
  }
  
  // ============= LAYER 5: Direct Fetch (último recurso) =============
  console.log('[extract-sora-video] ========== LAYER 5: Direct Fetch ==========');
  const directResult = await tryDirectFetch(url);
  if (directResult && directResult.videoUrl) {
    console.log('[extract-sora-video] SUCCESS via LAYER 5 (Direct Fetch)');
    directResult.method = 'direct-fetch';
    return directResult;
  }
  
  // Return error result
  return {
    videoUrl: null,
    videoUrlNoWatermark: null,
    title: null,
    prompt: null,
    thumbnailUrl: null,
    creator: null,
    originalUrl: url,
    hasWatermark: true,
    success: false,
    error: 'Não foi possível extrair o vídeo. Verifique se o link está correto e é público.',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, action, videoUrl } = await req.json();
    
    // Download proxy action - bypasses CORS
    if (action === 'download' && videoUrl) {
      console.log('[extract-sora-video] Download proxy for:', videoUrl);
      
      const cleanUrl = decodeUnicode(videoUrl);
      
      const videoResponse = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      
      if (!videoResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch video: ${videoResponse.status}` }),
          { status: videoResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const videoBlob = await videoResponse.arrayBuffer();
      
      return new Response(videoBlob, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="sora-video-${Date.now()}.mp4"`,
        },
      });
    }
    
    // Regular extraction
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-sora-video] Starting extraction for:', url);
    
    const videoInfo = await extractSoraVideo(url);
    
    console.log('[extract-sora-video] Result:', JSON.stringify(videoInfo));
    
    return new Response(
      JSON.stringify(videoInfo),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-sora-video] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
