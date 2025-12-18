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
}

// Try Firecrawl for JavaScript-rendered pages
async function tryFirecrawl(url: string): Promise<SoraVideoInfo | null> {
  const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!apiKey) {
    console.log('[extract-sora-video] Firecrawl API key not found');
    return null;
  }

  try {
    console.log('[extract-sora-video] Trying Firecrawl for:', url);
    
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

// Direct fetch extraction
async function tryDirectFetch(url: string): Promise<SoraVideoInfo | null> {
  try {
    console.log('[extract-sora-video] Trying direct fetch for:', url);
    
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
    .replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\u[\dA-Fa-f]{4}/g, (m) => 
      String.fromCharCode(parseInt(m.replace('\\u', ''), 16))
    )
    .replace(/\\/g, '');
}

async function extractSoraVideo(url: string): Promise<SoraVideoInfo> {
  console.log('[extract-sora-video] Processing URL:', url);
  
  // Try Firecrawl first (best for JS-rendered pages)
  const firecrawlResult = await tryFirecrawl(url);
  if (firecrawlResult && firecrawlResult.videoUrl) {
    console.log('[extract-sora-video] Success via Firecrawl');
    return firecrawlResult;
  }
  
  // Fallback to direct fetch
  const directResult = await tryDirectFetch(url);
  if (directResult && directResult.videoUrl) {
    console.log('[extract-sora-video] Success via direct fetch');
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
    const { url } = await req.json();
    
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
