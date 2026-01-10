import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VideoResult {
  id: string;
  source: 'shopee' | 'aliexpress' | 'pinterest' | 'youtube' | 'tiktok' | 'instagram';
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  duration?: string;
  author?: string;
  sourceUrl?: string;
  isSearchLink?: boolean;
}

interface MineResult {
  success: boolean;
  productName: string;
  keywords: string[];
  videos: VideoResult[];
  errors?: string[];
}

interface ProductInfo {
  name: string;
  keywords: string[];
  itemId?: string;
  shopId?: string;
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

    // Step 2: Search videos using NEW multi-layer approach
    const errors: string[] = [];
    const allVideos: VideoResult[] = [];

    // LAYER 1: Shopee Shop Videos (via Affiliate API)
    if (sources?.shopee !== false && productInfo.shopId) {
      try {
        console.log('🛒 LAYER 1: Searching Shopee shop videos...');
        const shopeeShopVideos = await searchShopeeShopVideos(productInfo.shopId, productInfo.itemId);
        allVideos.push(...shopeeShopVideos);
        console.log(`✅ Layer 1: Found ${shopeeShopVideos.length} videos from shop`);
      } catch (err) {
        console.error('Layer 1 error:', err);
        errors.push('Erro ao buscar vídeos da loja Shopee');
      }
    }

    // LAYER 2: Shopee Video Search (internal API + extract-shopee-video)
    if (sources?.shopee !== false) {
      try {
        console.log('🔍 LAYER 2: Searching Shopee videos by keyword...');
        const shopeeSearchVideos = await searchShopeeVideosByKeyword(productInfo.keywords);
        allVideos.push(...shopeeSearchVideos);
        console.log(`✅ Layer 2: Found ${shopeeSearchVideos.length} videos from search`);
      } catch (err) {
        console.error('Layer 2 error:', err);
        errors.push('Erro ao buscar vídeos na pesquisa Shopee');
      }
    }

    // LAYER 3: YouTube Videos (via search scraping)
    try {
      console.log('📺 LAYER 3: Searching YouTube videos...');
      const youtubeVideos = await searchYouTubeVideos(productInfo.keywords, productInfo.name);
      allVideos.push(...youtubeVideos);
      console.log(`✅ Layer 3: Found ${youtubeVideos.length} videos from YouTube`);
    } catch (err) {
      console.error('Layer 3 error:', err);
      errors.push('Erro ao buscar vídeos no YouTube');
    }

    // LAYER 5: TikTok Search Links
    try {
      console.log('🎵 LAYER 5: Generating TikTok search links...');
      const tiktokLinks = generateTikTokSearchLinks(productInfo.keywords, productInfo.name);
      allVideos.push(...tiktokLinks);
      console.log(`✅ Layer 5: Generated ${tiktokLinks.length} TikTok search links`);
    } catch (err) {
      console.error('Layer 5 error:', err);
    }

    // LAYER 6: Instagram Search Links
    try {
      console.log('📸 LAYER 6: Generating Instagram search links...');
      const instagramLinks = generateInstagramSearchLinks(productInfo.keywords, productInfo.name);
      allVideos.push(...instagramLinks);
      console.log(`✅ Layer 6: Generated ${instagramLinks.length} Instagram search links`);
    } catch (err) {
      console.error('Layer 6 error:', err);
    }

    // LAYER 4: AliExpress Videos (via Google site search)
    if (sources?.aliexpress !== false) {
      try {
        console.log('📦 LAYER 4: Searching AliExpress videos...');
        const aliexpressVideos = await searchAliExpressVideos(productInfo.keywords);
        allVideos.push(...aliexpressVideos);
        console.log(`✅ Layer 4: Found ${aliexpressVideos.length} videos from AliExpress`);
      } catch (err) {
        console.error('Layer 4 error:', err);
        errors.push('Erro ao buscar vídeos no AliExpress');
      }
    }

    // Remove duplicates by videoUrl
    const uniqueVideos = allVideos.filter((video, index, self) => 
      index === self.findIndex(v => v.videoUrl === video.videoUrl)
    );

    console.log(`✅ Total: Found ${uniqueVideos.length} unique videos`);

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

// ========== HELPER FUNCTIONS ==========

// Generate SHA-256 signature for Shopee Affiliate API
async function generateShopeeSignature(
  appId: string,
  timestamp: number,
  payload: string,
  secret: string
): Promise<string> {
  const signatureString = `${appId}${timestamp}${payload}${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateKeywords(productName: string): string[] {
  if (!productName) return [];

  // Clean and normalize
  const cleaned = productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s0-9]/g, ' ') // Keep numbers for model/specs
    .replace(/\s+/g, ' ')
    .trim();

  // Common words to remove (stopwords in Portuguese)
  const stopwords = new Set([
    'de', 'para', 'com', 'em', 'um', 'uma', 'e', 'ou', 'a', 'o', 'da', 'do', 'das', 'dos',
    'na', 'no', 'nas', 'nos', 'por', 'ao', 'aos', 'pelo', 'pela', 'pelos', 'pelas',
    'kit', 'pcs', 'unidades', 'unidade', 'pacote', 'conjunto', 'promocao', 'promo',
    'frete', 'gratis', 'oferta', 'original', 'novo', 'nova', 'qualidade', 'premium',
    'envio', 'rapido', 'entrega', 'brasil', 'pronta', 'estoque', 'loja', 'oficial'
  ]);

  // Extract meaningful keywords - prioritize specs, model, brand
  const words = cleaned.split(' ')
    .filter(w => w.length > 1 && !stopwords.has(w));

  // Take first 6 most relevant words (more specific)
  const keywords = words.slice(0, 6);

  // Create a more specific combined search term with product specifics
  const mainKeyword = keywords.slice(0, 4).join(' ');
  
  // Also save the full product name (cleaned) for exact searches
  const fullProductName = cleaned.slice(0, 60);

  return [fullProductName, mainKeyword, ...keywords].filter((k, i, arr) => k && arr.indexOf(k) === i);
}

// ========== PRODUCT INFO EXTRACTION ==========

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

    // Extract item_id and shop_id from various URL formats
    let itemId: string | undefined;
    let shopId: string | undefined;

    // Standard format: i.SHOP_ID.ITEM_ID
    let match = finalUrl.match(/i\.(\d+)\.(\d+)/);
    if (match) {
      shopId = match[1];
      itemId = match[2];
    }

    // Alternative format: /something/SHOP_ID/ITEM_ID
    if (!itemId) {
      match = finalUrl.match(/\/[a-zA-Z]+\/(\d+)\/(\d+)/);
      if (match) {
        shopId = match[1];
        itemId = match[2];
      }
    }

    console.log('Extracted IDs:', { itemId, shopId });

    // Try to get title from page HTML
    if (!productName) {
      try {
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
          const rawTitle = titleMatch[1]
            .replace(/\s*\|\s*Shopee\s*Brasil.*/i, '')
            .replace(/\s*-\s*Shopee.*/i, '')
            .trim();
          
          // Only use if it's a real product title (not just "Shopee Brasil" or similar)
          if (rawTitle.length > 5 && !rawTitle.toLowerCase().includes('shopee')) {
            productName = rawTitle;
          }
        }
      } catch {}
    }

    // If no product name but we have IDs, try Shopee Affiliate API
    if (!productName && itemId && shopId) {
      console.log('🔄 No product name found, trying Shopee Affiliate API...');
      const apiResult = await getProductFromAffiliateApi(itemId, shopId);
      if (apiResult) {
        return {
          name: apiResult.name,
          keywords: apiResult.keywords,
          itemId,
          shopId
        };
      }
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

// Get product info from Shopee Affiliate API (authenticated, works from servers)
async function getProductFromAffiliateApi(
  itemId: string,
  shopId: string
): Promise<{ name: string; keywords: string[] } | null> {
  const appId = Deno.env.get('SHOPEE_APP_ID');
  const appSecret = Deno.env.get('SHOPEE_APP_SECRET');

  if (!appId || !appSecret) {
    console.log('❌ Shopee Affiliate API credentials not configured');
    return null;
  }

  console.log('🔄 Trying Shopee Affiliate API for product info...');

  try {
    const timestamp = Math.floor(Date.now() / 1000);

    // Query products from the shop
    const graphqlQuery = {
      query: `query {
        productOfferV2(
          shopId: ${shopId}
          listType: 0
          sortType: 1
          page: 0
          limit: 50
        ) {
          nodes {
            productName
            productLink
            itemId
          }
        }
      }`
    };

    const payload = JSON.stringify(graphqlQuery);
    const signature = await generateShopeeSignature(appId, timestamp, payload, appSecret);

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });

    if (!response.ok) {
      console.log(`❌ Affiliate API returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log('📦 Affiliate API response:', JSON.stringify(data).slice(0, 500));

    const products = data.data?.productOfferV2?.nodes || [];

    // Try to find exact product by itemId
    let exactProduct = products.find((p: any) =>
      p.itemId?.toString() === itemId || 
      (p.productLink && p.productLink.includes(itemId))
    );

    // If not found by exact match, use first product from the shop
    if (!exactProduct && products.length > 0) {
      console.log('⚠️ Exact product not found, using first product from shop');
      exactProduct = products[0];
    }

    if (exactProduct?.productName) {
      console.log('✅ Got product from Affiliate API:', exactProduct.productName);
      return {
        name: exactProduct.productName,
        keywords: generateKeywords(exactProduct.productName)
      };
    }

    return null;
  } catch (error) {
    console.error('❌ Affiliate API error:', error);
    return null;
  }
}

// ========== LAYER 1: SHOPEE SHOP VIDEOS ==========
// Busca vídeos de produtos da mesma loja via Affiliate API

async function searchShopeeShopVideos(shopId: string, currentItemId?: string): Promise<VideoResult[]> {
  console.log('🛒 Layer 1: Searching videos from shop:', shopId);
  const videos: VideoResult[] = [];

  const appId = Deno.env.get('SHOPEE_APP_ID');
  const appSecret = Deno.env.get('SHOPEE_APP_SECRET');

  if (!appId || !appSecret) {
    console.log('⚠️ Shopee Affiliate API not configured');
    return videos;
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);

    // Query products from the shop
    const graphqlQuery = {
      query: `query {
        productOfferV2(
          shopId: ${shopId}
          listType: 0
          sortType: 1
          page: 0
          limit: 20
        ) {
          nodes {
            productName
            productLink
            itemId
            imageUrl
          }
        }
      }`
    };

    const payload = JSON.stringify(graphqlQuery);
    const signature = await generateShopeeSignature(appId, timestamp, payload, appSecret);

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });

    if (!response.ok) {
      console.log(`❌ Affiliate API returned ${response.status}`);
      return videos;
    }

    const data = await response.json();
    const products = data.data?.productOfferV2?.nodes || [];

    console.log(`📦 Found ${products.length} products from shop`);

    // For each product, try to extract video via our extract-shopee-video function
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️ Supabase credentials not available for calling extract-shopee-video');
      return videos;
    }

    // Try up to 5 products (excluding current one)
    const productsToTry = products
      .filter((p: any) => p.productLink && p.itemId?.toString() !== currentItemId)
      .slice(0, 5);

    for (const product of productsToTry) {
      try {
        console.log(`🔍 Trying to extract video from: ${product.productName?.slice(0, 50)}...`);
        
        const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-shopee-video`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: product.productLink }),
        });

        if (extractResponse.ok) {
          const videoInfo = await extractResponse.json();
          
          if (videoInfo.videoUrl || videoInfo.videoUrlNoWatermark) {
            videos.push({
              id: `shopee_shop_${product.itemId || Date.now()}`,
              source: 'shopee',
              videoUrl: videoInfo.videoUrlNoWatermark || videoInfo.videoUrl,
              thumbnailUrl: videoInfo.thumbnailUrl || product.imageUrl || '',
              title: product.productName || 'Vídeo Shopee',
              sourceUrl: product.productLink,
            });
            console.log(`✅ Found video for product: ${product.productName?.slice(0, 30)}...`);
          }
        }
      } catch (err) {
        console.error('Error extracting video:', err);
      }
    }

  } catch (error) {
    console.error('Layer 1 error:', error);
  }

  return videos;
}

// ========== LAYER 2: SHOPEE KEYWORD SEARCH ==========
// Busca vídeos por palavra-chave usando Firecrawl + extract-shopee-video

async function searchShopeeVideosByKeyword(keywords: string[]): Promise<VideoResult[]> {
  console.log('🔍 Layer 2: Searching Shopee videos by keyword:', keywords);
  const videos: VideoResult[] = [];

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    console.log('⚠️ FIRECRAWL_API_KEY not configured');
    return videos;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.log('⚠️ Supabase credentials not available');
    return videos;
  }

  try {
    const searchQuery = keywords[0] || keywords.join(' ');
    
    // Strategy 1: Try Shopee Video tab (sv.shopee URLs)
    const videoSearchUrl = `https://shopee.com.br/search?keyword=${encodeURIComponent(searchQuery)}&type=video`;
    
    console.log('🔍 Searching Shopee videos:', videoSearchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoSearchUrl,
        formats: ['html'],
        waitFor: 5000,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error('Firecrawl error:', scrapeResponse.status);
      return videos;
    }

    const scrapeData = await scrapeResponse.json();
    const html = scrapeData.data?.html || '';

    // Extract sv.shopee video URLs
    const videoLinkPatterns = [
      /https?:\/\/sv\.shopee\.com\.br\/[^\s"'<>]+/gi,
      /https?:\/\/shopee\.com\.br\/share-video[^\s"'<>]+/gi,
      /https?:\/\/s\.shopee\.com\.br\/[A-Za-z0-9]+/gi,
    ];

    const foundLinks: string[] = [];
    for (const pattern of videoLinkPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const link of matches) {
          if (!foundLinks.includes(link) && foundLinks.length < 10) {
            foundLinks.push(link);
          }
        }
      }
    }

    // Also extract regular product links that might have videos
    const productLinkMatches = html.matchAll(/href="([^"]*-i\.\d+\.\d+[^"]*)"/g);
    for (const match of productLinkMatches) {
      const link = match[1].startsWith('http') ? match[1] : `https://shopee.com.br${match[1]}`;
      if (!foundLinks.includes(link) && foundLinks.length < 15) {
        foundLinks.push(link);
      }
    }

    console.log(`📦 Found ${foundLinks.length} potential video links`);

    // Try to extract videos from each link
    for (const link of foundLinks.slice(0, 8)) {
      try {
        console.log(`🔍 Extracting video from: ${link.slice(0, 80)}...`);
        
        const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-shopee-video`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: link }),
        });

        if (extractResponse.ok) {
          const videoInfo = await extractResponse.json();
          
          if (videoInfo.videoUrl || videoInfo.videoUrlNoWatermark) {
            videos.push({
              id: `shopee_search_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              source: 'shopee',
              videoUrl: videoInfo.videoUrlNoWatermark || videoInfo.videoUrl,
              thumbnailUrl: videoInfo.thumbnailUrl || '',
              title: videoInfo.title || videoInfo.description || `Vídeo Shopee - ${searchQuery}`,
              sourceUrl: link,
            });
            console.log(`✅ Found video from search`);
          }
        }
      } catch (err) {
        console.error('Error extracting video:', err);
      }
    }

  } catch (error) {
    console.error('Layer 2 error:', error);
  }

  return videos;
}

// ========== LAYER 3: YOUTUBE VIDEOS ==========
// Busca vídeos de review/unboxing no YouTube

async function searchYouTubeVideos(keywords: string[], productName: string): Promise<VideoResult[]> {
  console.log('📺 Layer 3: Searching YouTube videos:', keywords);
  const videos: VideoResult[] = [];

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    console.log('⚠️ FIRECRAWL_API_KEY not configured');
    return videos;
  }

  try {
    // Use more specific search with product name in quotes for exact match
    const exactProduct = productName.slice(0, 50).replace(/[^\w\s]/g, '');
    const searchQuery = `"${exactProduct}" review`;
    const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

    console.log('🔍 Searching YouTube:', youtubeUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: youtubeUrl,
        formats: ['html'],
        waitFor: 3000,
        timeout: 30000,
      }),
    });

    if (!scrapeResponse.ok) {
      console.error('Firecrawl YouTube error:', scrapeResponse.status);
      return videos;
    }

    const scrapeData = await scrapeResponse.json();
    const html = scrapeData.data?.html || '';

    // Extract YouTube video IDs from various patterns
    const videoIdPatterns = [
      /\/watch\?v=([a-zA-Z0-9_-]{11})/g,
      /"videoId":\s*"([a-zA-Z0-9_-]{11})"/g,
      /\/embed\/([a-zA-Z0-9_-]{11})/g,
    ];

    const foundVideoIds: string[] = [];
    for (const pattern of videoIdPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (!foundVideoIds.includes(match[1]) && foundVideoIds.length < 10) {
          foundVideoIds.push(match[1]);
        }
      }
    }

    console.log(`📹 Found ${foundVideoIds.length} YouTube video IDs`);

    // Extract titles for the videos
    const titleMatches = html.matchAll(/"title":\s*\{"runs":\s*\[\{"text":\s*"([^"]+)"\}\]/g);
    const titles: string[] = [];
    for (const match of titleMatches) {
      titles.push(match[1]);
    }

    // Create video results
    for (let i = 0; i < Math.min(foundVideoIds.length, 5); i++) {
      const videoId = foundVideoIds[i];
      videos.push({
        id: `youtube_${videoId}`,
        source: 'youtube',
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        title: titles[i] || `Vídeo YouTube - ${keywords[0] || 'produto'}`,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

  } catch (error) {
    console.error('Layer 3 error:', error);
  }

  return videos;
}

// ========== LAYER 4: ALIEXPRESS VIDEOS ==========
// Busca vídeos no AliExpress via Google site search

async function searchAliExpressVideos(keywords: string[]): Promise<VideoResult[]> {
  console.log('📦 Layer 4: Searching AliExpress videos:', keywords);
  const videos: VideoResult[] = [];

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    console.log('⚠️ FIRECRAWL_API_KEY not configured');
    return videos;
  }

  try {
    const searchQuery = keywords[0] || keywords.join(' ');
    // Use AliExpress direct search
    const searchUrl = `https://pt.aliexpress.com/wholesale?SearchText=${encodeURIComponent(searchQuery)}`;

    console.log('🔍 Searching AliExpress:', searchUrl);

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: ['html'],
        waitFor: 4000,
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
    const linkPatterns = [
      /href="([^"]*\/item\/\d+\.html[^"]*)"/gi,
      /href="([^"]*aliexpress\.[a-z]+\/item\/[^"]*)"/gi,
    ];

    for (const pattern of linkPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        let link = match[1];
        if (!link.startsWith('http')) {
          link = `https://pt.aliexpress.com${link}`;
        }
        if (!productLinks.includes(link) && productLinks.length < 5) {
          productLinks.push(link);
        }
      }
    }

    console.log(`📦 Found ${productLinks.length} AliExpress product links`);

    // For each product, try to find video
    for (const productLink of productLinks.slice(0, 3)) {
      try {
        const productResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: productLink,
            formats: ['html'],
            waitFor: 3000,
            timeout: 20000,
          }),
        });

        if (!productResponse.ok) continue;

        const productData = await productResponse.json();
        const productHtml = productData.data?.html || '';

        // Extract video URLs
        const videoPatterns = [
          /https?:\/\/[^"'\s]*alicdn\.com[^"'\s]*\.mp4/gi,
          /"videoUrl":\s*"([^"]+\.mp4[^"]*)"/gi,
          /"video":\s*\{[^}]*"url":\s*"([^"]+)"/gi,
        ];

        for (const pattern of videoPatterns) {
          const matches = productHtml.matchAll(pattern);
          for (const match of matches) {
            const videoUrl = (match[1] || match[0]).replace(/\\u002F/g, '/').replace(/\\/g, '');
            if (videoUrl && videoUrl.includes('.mp4')) {
              videos.push({
                id: `aliexpress_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                source: 'aliexpress',
                videoUrl,
                thumbnailUrl: '',
                title: `Vídeo AliExpress - ${searchQuery}`,
                sourceUrl: productLink,
              });
              break;
            }
          }
          if (videos.filter(v => v.source === 'aliexpress').length >= 3) break;
        }
      } catch (err) {
        console.error('Error scraping AliExpress product:', err);
      }
    }

  } catch (error) {
    console.error('Layer 4 error:', error);
  }

  return videos;
}

// ========== LAYER 5: TIKTOK SEARCH LINKS ==========
// Gera links de busca direta no TikTok para o usuário abrir

function generateTikTokSearchLinks(keywords: string[], productName: string): VideoResult[] {
  console.log('🎵 Layer 5: Generating TikTok search links');
  
  // Clean product name for TikTok search
  const cleanedName = productName
    .slice(0, 40)
    .replace(/[^\w\s]/g, '')
    .trim();
  
  if (!cleanedName) return [];

  const tiktokSearchUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(cleanedName)}`;
  
  return [{
    id: `tiktok_search_${Date.now()}`,
    source: 'tiktok',
    videoUrl: tiktokSearchUrl,
    thumbnailUrl: '',
    title: `🔍 Buscar "${cleanedName}" no TikTok`,
    sourceUrl: tiktokSearchUrl,
    isSearchLink: true,
  }];
}

// ========== LAYER 6: INSTAGRAM SEARCH LINKS ==========
// Gera links de busca/hashtag no Instagram para o usuário abrir

function generateInstagramSearchLinks(keywords: string[], productName: string): VideoResult[] {
  console.log('📸 Layer 6: Generating Instagram search links');
  
  // Create hashtag from product keywords
  const mainKeywords = keywords.slice(0, 3).join('');
  const hashtag = mainKeywords
    .replace(/[^\w]/g, '')
    .toLowerCase()
    .slice(0, 30);
  
  if (!hashtag || hashtag.length < 3) return [];

  const instagramHashtagUrl = `https://www.instagram.com/explore/tags/${hashtag}/`;
  
  // Also create a Reels search link
  const cleanedName = productName
    .slice(0, 30)
    .replace(/[^\w\s]/g, '')
    .trim();
  
  const results: VideoResult[] = [{
    id: `instagram_hashtag_${Date.now()}`,
    source: 'instagram',
    videoUrl: instagramHashtagUrl,
    thumbnailUrl: '',
    title: `🔍 Explorar #${hashtag} no Instagram`,
    sourceUrl: instagramHashtagUrl,
    isSearchLink: true,
  }];

  return results;
}
