import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoResult {
  id: string;
  source: 'shopee' | 'aliexpress' | 'pinterest' | 'tiktok';
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  duration?: string;
  author?: string;
  sourceUrl?: string;
}

interface MineResult {
  success: boolean;
  productName: string;
  keywords: string[];
  videos: VideoResult[];
  errors?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, sources } = await req.json();
    console.log('🔍 Mining videos for URL:', url);
    console.log('📌 Sources enabled:', sources);

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL inválida. Por favor, forneça um link de produto.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract product info from URL
    const productInfo = await extractProductInfo(url);
    console.log('📦 Product info:', productInfo);

    if (!productInfo.keywords.length) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Não foi possível identificar o produto. Verifique o link.',
          productName: '',
          keywords: [],
          videos: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Search videos in parallel from enabled sources
    const searchPromises: Promise<VideoResult[]>[] = [];
    const errors: string[] = [];

    if (sources?.shopee !== false) {
      searchPromises.push(
        searchShopeeVideos(productInfo.keywords, url)
          .catch(err => {
            console.error('Shopee search error:', err);
            errors.push('Erro ao buscar vídeos na Shopee');
            return [];
          })
      );
    }

    if (sources?.aliexpress !== false) {
      searchPromises.push(
        searchAliExpressVideos(productInfo.keywords)
          .catch(err => {
            console.error('AliExpress search error:', err);
            errors.push('Erro ao buscar vídeos no AliExpress');
            return [];
          })
      );
    }

    if (sources?.pinterest !== false) {
      searchPromises.push(
        searchPinterestVideos(productInfo.keywords)
          .catch(err => {
            console.error('Pinterest search error:', err);
            errors.push('Erro ao buscar vídeos no Pinterest');
            return [];
          })
      );
    }

    const results = await Promise.all(searchPromises);
    const allVideos = results.flat();

    // Remove duplicates by videoUrl
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.videoUrl === video.videoUrl)
    );

    console.log(`✅ Found ${uniqueVideos.length} unique videos`);

    const result: MineResult = {
      success: true,
      productName: productInfo.name,
      keywords: productInfo.keywords,
      videos: uniqueVideos,
      errors: errors.length > 0 ? errors : undefined
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error mining videos:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erro ao minerar vídeos. Tente novamente.',
        productName: '',
        keywords: [],
        videos: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface ProductInfo {
  name: string;
  keywords: string[];
  itemId?: string;
  shopId?: string;
}

async function extractProductInfo(url: string): Promise<ProductInfo> {
  console.log('📋 Extracting product info from:', url);
  
  try {
    // Follow redirects to get final URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });

    const finalUrl = response.url;
    console.log('Final URL:', finalUrl);

    // Extract product name from URL
    let productName = '';
    const urlPath = new URL(finalUrl).pathname;
    const pathMatch = urlPath.match(/\/([^\/]+)-i\.\d+\.\d+/);
    if (pathMatch) {
      productName = decodeURIComponent(pathMatch[1]).replace(/-/g, ' ');
    }

    // Extract item_id and shop_id
    let itemId: string | undefined;
    let shopId: string | undefined;

    let match = finalUrl.match(/i\.(\d+)\.(\d+)/);
    if (match) {
      shopId = match[1];
      itemId = match[2];
    }

    if (!itemId) {
      match = finalUrl.match(/\/[a-zA-Z]+\/(\d+)\/(\d+)/);
      if (match) {
        shopId = match[1];
        itemId = match[2];
      }
    }

    // Try to get title from page HTML
    if (!productName) {
      try {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          productName = titleMatch[1]
            .replace(/\s*\|\s*Shopee\s*Brasil.*/i, '')
            .replace(/\s*-\s*Shopee.*/i, '')
            .trim();
        }
      } catch {}
    }

    // Generate keywords from product name
    const keywords = generateKeywords(productName);

    console.log('Product name:', productName);
    console.log('Keywords:', keywords);

    return {
      name: productName,
      keywords,
      itemId,
      shopId
    };

  } catch (error) {
    console.error('Error extracting product info:', error);
    return { name: '', keywords: [] };
  }
}

function generateKeywords(productName: string): string[] {
  if (!productName) return [];

  // Clean and normalize
  const cleaned = productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ' ') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();

  // Common words to remove (stopwords in Portuguese)
  const stopwords = new Set([
    'de', 'para', 'com', 'em', 'um', 'uma', 'e', 'ou', 'a', 'o', 'da', 'do', 'das', 'dos',
    'na', 'no', 'nas', 'nos', 'por', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas',
    'kit', 'pcs', 'unidades', 'unidade', 'pacote', 'conjunto', 'promocao', 'promo',
    'frete', 'gratis', 'oferta', 'original', 'novo', 'nova', 'qualidade', 'premium'
  ]);

  // Extract meaningful keywords
  const words = cleaned.split(' ')
    .filter(w => w.length > 2 && !stopwords.has(w));

  // Take first 5 most relevant words
  const keywords = words.slice(0, 5);

  // Also create a combined search term
  const mainKeyword = keywords.slice(0, 3).join(' ');

  return [mainKeyword, ...keywords].filter(Boolean);
}

async function searchShopeeVideos(keywords: string[], originalUrl: string): Promise<VideoResult[]> {
  console.log('🛒 Searching Shopee videos for:', keywords);
  const videos: VideoResult[] = [];
  
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    console.log('⚠️ FIRECRAWL_API_KEY not configured, skipping Shopee search');
    return videos;
  }

  try {
    const searchQuery = keywords[0] || keywords.join(' ');
    const searchUrl = `https://shopee.com.br/search?keyword=${encodeURIComponent(searchQuery)}`;

    console.log('🔍 Scraping Shopee search:', searchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['html'],
        waitFor: 3000,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error('Firecrawl Shopee error:', scrapeResponse.status);
      return videos;
    }

    const scrapeData = await scrapeResponse.json();
    const html = scrapeData.data?.html || '';

    // Extract product links from search results
    const productLinks: string[] = [];
    const linkMatches = html.matchAll(/href="([^"]*-i\.\d+\.\d+[^"]*)"/g);
    for (const match of linkMatches) {
      const link = match[1].startsWith('http') ? match[1] : `https://shopee.com.br${match[1]}`;
      if (!productLinks.includes(link) && productLinks.length < 5) {
        productLinks.push(link);
      }
    }

    console.log(`📦 Found ${productLinks.length} product links`);

    // For each product, try to extract video
    for (const productLink of productLinks.slice(0, 3)) {
      try {
        const productHtml = await scrapeProductForVideo(productLink, firecrawlKey);
        const videoUrls = extractVideoUrls(productHtml, 'shopee');
        
        for (const videoUrl of videoUrls) {
          videos.push({
            id: `shopee_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            source: 'shopee',
            videoUrl,
            thumbnailUrl: videoUrl.replace(/\.(mp4|webm|mov)$/i, '.jpg'),
            title: `Vídeo Shopee`,
            sourceUrl: productLink,
          });
        }
      } catch (e) {
        console.error('Error scraping product:', e);
      }
    }

  } catch (error) {
    console.error('Error searching Shopee videos:', error);
  }

  return videos;
}

async function searchAliExpressVideos(keywords: string[]): Promise<VideoResult[]> {
  console.log('📦 Searching AliExpress videos for:', keywords);
  const videos: VideoResult[] = [];

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    console.log('⚠️ FIRECRAWL_API_KEY not configured, skipping AliExpress search');
    return videos;
  }

  try {
    const searchQuery = keywords[0] || keywords.join(' ');
    const searchUrl = `https://pt.aliexpress.com/w/wholesale-${encodeURIComponent(searchQuery.replace(/ /g, '-'))}.html`;

    console.log('🔍 Scraping AliExpress search:', searchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['html'],
        waitFor: 3000,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error('Firecrawl AliExpress error:', scrapeResponse.status);
      return videos;
    }

    const scrapeData = await scrapeResponse.json();
    const html = scrapeData.data?.html || '';

    // Extract product links
    const productLinks: string[] = [];
    const linkMatches = html.matchAll(/href="([^"]*\/item\/[^"]*)"/g);
    for (const match of linkMatches) {
      const link = match[1].startsWith('http') ? match[1] : `https://pt.aliexpress.com${match[1]}`;
      if (!productLinks.includes(link) && productLinks.length < 5) {
        productLinks.push(link);
      }
    }

    // Also try different pattern
    const altMatches = html.matchAll(/href="([^"]*aliexpress\.com[^"]*\/item\/\d+\.html[^"]*)"/g);
    for (const match of altMatches) {
      if (!productLinks.includes(match[1]) && productLinks.length < 5) {
        productLinks.push(match[1]);
      }
    }

    console.log(`📦 Found ${productLinks.length} AliExpress product links`);

    // For each product, try to extract video
    for (const productLink of productLinks.slice(0, 3)) {
      try {
        const productHtml = await scrapeProductForVideo(productLink, firecrawlKey);
        const videoUrls = extractVideoUrls(productHtml, 'aliexpress');
        
        for (const videoUrl of videoUrls) {
          videos.push({
            id: `aliexpress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            source: 'aliexpress',
            videoUrl,
            thumbnailUrl: '',
            title: `Vídeo AliExpress`,
            sourceUrl: productLink,
          });
        }
      } catch (e) {
        console.error('Error scraping AliExpress product:', e);
      }
    }

  } catch (error) {
    console.error('Error searching AliExpress videos:', error);
  }

  return videos;
}

async function searchPinterestVideos(keywords: string[]): Promise<VideoResult[]> {
  console.log('📌 Searching Pinterest videos for:', keywords);
  const videos: VideoResult[] = [];

  const pinterestAppId = Deno.env.get('PINTEREST_APP_ID');
  const pinterestAppSecret = Deno.env.get('PINTEREST_APP_SECRET');

  if (!pinterestAppId || !pinterestAppSecret) {
    console.log('⚠️ Pinterest credentials not configured, skipping Pinterest search');
    return videos;
  }

  // Pinterest API requires OAuth token, so we'll use Firecrawl as fallback
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    console.log('⚠️ FIRECRAWL_API_KEY not configured for Pinterest scraping');
    return videos;
  }

  try {
    const searchQuery = keywords[0] || keywords.join(' ');
    const searchUrl = `https://br.pinterest.com/search/videos/?q=${encodeURIComponent(searchQuery)}`;

    console.log('🔍 Scraping Pinterest search:', searchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['html'],
        waitFor: 3000,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error('Firecrawl Pinterest error:', scrapeResponse.status);
      return videos;
    }

    const scrapeData = await scrapeResponse.json();
    const html = scrapeData.data?.html || '';

    // Extract video pins
    const videoUrls = extractVideoUrls(html, 'pinterest');
    
    for (const videoUrl of videoUrls.slice(0, 10)) {
      videos.push({
        id: `pinterest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: 'pinterest',
        videoUrl,
        thumbnailUrl: '',
        title: `Vídeo Pinterest - ${searchQuery}`,
      });
    }

    // Also try to find pin links and scrape them
    const pinMatches = html.matchAll(/href="\/pin\/(\d+)\/"/g);
    const pinIds: string[] = [];
    for (const match of pinMatches) {
      if (pinIds.length < 5 && !pinIds.includes(match[1])) {
        pinIds.push(match[1]);
      }
    }

    console.log(`📌 Found ${pinIds.length} pin IDs`);

    for (const pinId of pinIds.slice(0, 3)) {
      try {
        const pinUrl = `https://br.pinterest.com/pin/${pinId}/`;
        const pinHtml = await scrapeProductForVideo(pinUrl, firecrawlKey);
        const pinVideos = extractVideoUrls(pinHtml, 'pinterest');
        
        for (const videoUrl of pinVideos) {
          if (!videos.find(v => v.videoUrl === videoUrl)) {
            videos.push({
              id: `pinterest_${pinId}`,
              source: 'pinterest',
              videoUrl,
              thumbnailUrl: '',
              title: `Pin ${pinId}`,
              sourceUrl: pinUrl,
            });
          }
        }
      } catch (e) {
        console.error('Error scraping Pinterest pin:', e);
      }
    }

  } catch (error) {
    console.error('Error searching Pinterest videos:', error);
  }

  return videos;
}

async function scrapeProductForVideo(url: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html'],
        waitFor: 2000,
        timeout: 20000,
      }),
    });

    if (!response.ok) {
      return '';
    }

    const data = await response.json();
    return data.data?.html || '';
  } catch (error) {
    console.error('Error scraping product:', error);
    return '';
  }
}

function extractVideoUrls(html: string, source: string): string[] {
  const videos: string[] = [];

  // Common video patterns
  const patterns: RegExp[] = [];

  if (source === 'shopee') {
    patterns.push(
      /https?:\/\/cvf\.shopee\.com\.br\/file\/[a-zA-Z0-9_-]+/g,
      /https?:\/\/v\.shopee\.com\.br\/[a-zA-Z0-9_\/-]+\.mp4/g,
      /"video[Uu]rl"\s*:\s*"([^"]+)"/g,
    );
  } else if (source === 'aliexpress') {
    patterns.push(
      /https?:\/\/video\.aliexpress\.[a-z]+\/[^\s"'<>]+\.mp4/gi,
      /https?:\/\/ae\d+\.alicdn\.com\/[^\s"'<>]+\.mp4/gi,
      /"videoUrl"\s*:\s*"([^"]+)"/g,
    );
  } else if (source === 'pinterest') {
    patterns.push(
      /https?:\/\/v\d*\.pinimg\.com\/videos\/[^\s"'<>]+\.mp4/gi,
      /"video_list"[^}]*"url"\s*:\s*"([^"]+\.mp4[^"]*)"/g,
      /https?:\/\/[^\s"'<>]+pinimg\.com[^\s"'<>]+\.mp4/gi,
    );
  }

  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      // If it's a capture group pattern, use the captured group
      const url = match[1] || match[0];
      if (url && !videos.includes(url) && url.includes('http')) {
        // Unescape URL if needed
        const cleanUrl = url.replace(/\\u002F/g, '/').replace(/\\/g, '');
        if (cleanUrl.match(/\.(mp4|webm|mov)/i)) {
          videos.push(cleanUrl);
        }
      }
    }
  }

  console.log(`📹 Extracted ${videos.length} videos from ${source}`);
  return videos;
}
