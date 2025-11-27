import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log('Extracting from URL:', url);

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL inválida. Por favor, forneça um link válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if it's a Shopee URL
    const isShopeeUrl = url.includes('shopee.com') || url.includes('s.shopee');

    if (isShopeeUrl) {
      const result = await extractFromShopeeAffiliate(url);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For non-Shopee URLs, use generic extraction
    const result = await extractGeneric(url);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting data:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao extrair dados. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate SHA256 signature for Shopee Affiliate API
async function generateShopeeSignature(appId: string, timestamp: number, payload: string, secret: string): Promise<string> {
  const signatureString = `${appId}${timestamp}${payload}${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function extractFromShopeeAffiliate(url: string): Promise<{ title: string; images: string[]; success: boolean; error?: string }> {
  console.log('Detected Shopee URL, using Affiliate API...');

  const appId = Deno.env.get('SHOPEE_APP_ID');
  const appSecret = Deno.env.get('SHOPEE_APP_SECRET');

  if (!appId || !appSecret) {
    console.log('Shopee API credentials not configured, falling back to generic extraction');
    return await extractGeneric(url);
  }

  try {
    // Step 1: Follow redirects to get final URL and extract IDs
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    const finalUrl = response.url;
    console.log('Final URL after redirects:', finalUrl);

    // Step 2: Extract item_id from URL
    let itemId: string | null = null;
    let shopId: string | null = null;

    // Pattern 1: i.SHOP_ID.ITEM_ID
    let match = finalUrl.match(/i\.(\d+)\.(\d+)/);
    if (match) {
      shopId = match[1];
      itemId = match[2];
      console.log('Pattern 1 matched: i.SHOP_ID.ITEM_ID');
    }

    // Pattern 2: /lp/SHOP_ID/ITEM_ID
    if (!itemId) {
      match = finalUrl.match(/\/lp\/(\d+)\/(\d+)/);
      if (match) {
        shopId = match[1];
        itemId = match[2];
        console.log('Pattern 2 matched: /lp/SHOP_ID/ITEM_ID');
      }
    }

    // Pattern 3: /SELLER/SHOP_ID/ITEM_ID
    if (!itemId) {
      match = finalUrl.match(/\/[a-zA-Z]+\/(\d+)\/(\d+)/);
      if (match) {
        shopId = match[1];
        itemId = match[2];
        console.log('Pattern 3 matched: /SELLER/SHOP_ID/ITEM_ID');
      }
    }

    console.log('Extracted IDs - shopId:', shopId, 'itemId:', itemId);

    if (!itemId) {
      console.log('Could not extract item ID from URL, falling back to generic extraction');
      return await extractGeneric(url);
    }

    // Step 3: Use Shopee Affiliate API to get product details
    const timestamp = Math.floor(Date.now() / 1000);
    
    // GraphQL query to get product offer by item IDs
    const graphqlQuery = {
      query: `query {
        productOffer(
          itemIds: [${itemId}]
          limit: 1
        ) {
          nodes {
            productName
            imageUrl
            offerLink
            originalLink
            price
            priceMin
            priceMax
            commissionRate
            shopName
            shopId
            itemId
          }
        }
      }`
    };

    const payload = JSON.stringify(graphqlQuery);
    const signature = await generateShopeeSignature(appId, timestamp, payload, appSecret);

    console.log('Calling Shopee Affiliate API...');
    console.log('AppId:', appId);
    console.log('Timestamp:', timestamp);
    console.log('Payload:', payload);

    const apiResponse = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });

    console.log('API Response status:', apiResponse.status);
    const responseText = await apiResponse.text();
    console.log('API Response text:', responseText);

    if (!apiResponse.ok) {
      console.error('Shopee Affiliate API error:', responseText);
      return await extractFromShopeeInternal(finalUrl, shopId, itemId);
    }

    const apiData = JSON.parse(responseText);
    console.log('API Response data:', JSON.stringify(apiData, null, 2));

    if (apiData.errors && apiData.errors.length > 0) {
      console.error('GraphQL errors:', apiData.errors);
      return await extractFromShopeeInternal(finalUrl, shopId, itemId);
    }

    const products = apiData.data?.productOffer?.nodes;
    if (!products || products.length === 0) {
      console.log('No products found in API response, trying internal API');
      return await extractFromShopeeInternal(finalUrl, shopId, itemId);
    }

    const product = products[0];
    const images: string[] = [];
    
    if (product.imageUrl) {
      images.push(product.imageUrl);
    }

    console.log('Extracted from Affiliate API - title:', product.productName, 'images:', images.length);

    // If we only got 1 image from affiliate API, try to get more from internal API
    if (images.length <= 1 && shopId) {
      console.log('Only 1 image from Affiliate API, fetching more from internal API...');
      const internalResult = await extractFromShopeeInternal(finalUrl, shopId, itemId);
      if (internalResult.images.length > images.length) {
        return {
          title: product.productName || internalResult.title,
          images: internalResult.images,
          success: true
        };
      }
    }

    return {
      title: product.productName || 'Produto Shopee',
      images: images,
      success: true
    };

  } catch (error) {
    console.error('Error in Shopee Affiliate extraction:', error);
    return await extractGeneric(url);
  }
}

async function extractFromShopeeInternal(finalUrl: string, shopId: string | null, itemId: string | null): Promise<{ title: string; images: string[]; success: boolean; error?: string }> {
  console.log('Using Shopee internal API extraction...');

  if (!shopId || !itemId) {
    return await extractGeneric(finalUrl);
  }

  try {
    const apiUrl = `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`;
    console.log('Calling Shopee internal API:', apiUrl);

    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': finalUrl,
        'x-shopee-language': 'pt-BR',
        'x-api-source': 'pc',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    console.log('Internal API Response status:', apiResponse.status);

    if (!apiResponse.ok) {
      console.log('Internal API request failed, falling back to generic extraction');
      return await extractGeneric(finalUrl);
    }

    const apiData = await apiResponse.json();
    console.log('Internal API Response data keys:', Object.keys(apiData));

    const itemData = apiData.data || apiData.item || apiData;
    
    if (!itemData) {
      console.log('No item data in internal API response, falling back to generic extraction');
      return await extractGeneric(finalUrl);
    }

    const title = itemData.name || itemData.title || 'Produto Shopee';
    console.log('Extracted title from internal API:', title);

    const images: string[] = [];

    if (itemData.image) {
      images.push(`https://cf.shopee.com.br/file/${itemData.image}`);
    }

    if (itemData.images && Array.isArray(itemData.images)) {
      for (const imgId of itemData.images) {
        const imgUrl = `https://cf.shopee.com.br/file/${imgId}`;
        if (!images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }
    }

    if (itemData.tier_variations) {
      for (const variation of itemData.tier_variations) {
        if (variation.images) {
          for (const imgId of variation.images) {
            if (imgId) {
              const imgUrl = `https://cf.shopee.com.br/file/${imgId}`;
              if (!images.includes(imgUrl)) {
                images.push(imgUrl);
              }
            }
          }
        }
      }
    }

    console.log('Extracted images count from internal API:', images.length);

    if (images.length === 0) {
      console.log('No images found in internal API response, falling back to generic extraction');
      return await extractGeneric(finalUrl);
    }

    return {
      title,
      images: images.slice(0, 15),
      success: true
    };

  } catch (error) {
    console.error('Error in Shopee internal extraction:', error);
    return await extractGeneric(finalUrl);
  }
}

async function extractGeneric(url: string): Promise<{ title: string; images: string[]; success: boolean; error?: string }> {
  console.log('Using generic extraction for:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    console.log('HTML length:', html.length);

    const images: string[] = [];
    let title = '';

    // Try to extract from JSON-LD structured data
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const jsonContent = match[1];
        const jsonData = JSON.parse(jsonContent);
        
        if (jsonData.image) {
          const imgArray = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
          for (const img of imgArray) {
            if (typeof img === 'string' && img.startsWith('http')) {
              images.push(img);
            } else if (img?.url && img.url.startsWith('http')) {
              images.push(img.url);
            }
          }
        }
        
        if (jsonData.name && !title) {
          title = jsonData.name;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    // Extract from og:image meta tags
    const ogImageMatches = html.matchAll(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi);
    for (const match of ogImageMatches) {
      if (match[1] && match[1].startsWith('http') && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }

    // Also try reverse order
    const ogImageMatches2 = html.matchAll(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/gi);
    for (const match of ogImageMatches2) {
      if (match[1] && match[1].startsWith('http') && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }

    // Extract from og:title
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && !title) {
      title = ogTitleMatch[1];
    }

    // Extract from title tag
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*[\||\-]\s*.*$/i, '').trim();
      }
    }

    // Extract all image URLs from img tags
    const imgTagMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgTagMatches) {
      const imgUrl = match[1];
      if (imgUrl && imgUrl.startsWith('http') && isProductImage(imgUrl) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Extract from data-src attributes
    const dataSrcMatches = html.matchAll(/data-src=["']([^"']+)["']/gi);
    for (const match of dataSrcMatches) {
      const imgUrl = match[1];
      if (imgUrl && imgUrl.startsWith('http') && isProductImage(imgUrl) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Extract images from srcset
    const srcsetMatches = html.matchAll(/srcset=["']([^"']+)["']/gi);
    for (const match of srcsetMatches) {
      const srcset = match[1];
      const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
      for (const imgUrl of urls) {
        if (imgUrl && imgUrl.startsWith('http') && isProductImage(imgUrl) && !images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }
    }

    // Clean and filter images
    const uniqueImages = [...new Set(images)]
      .map(img => cleanImageUrl(img))
      .filter(img => img && img.length > 10 && isProductImage(img))
      .slice(0, 15);

    console.log('Extracted title:', title);
    console.log('Extracted images count:', uniqueImages.length);

    return {
      title: title || 'Produto',
      images: uniqueImages,
      success: true
    };

  } catch (error) {
    console.error('Error in generic extraction:', error);
    return {
      title: 'Produto',
      images: [],
      success: false,
      error: 'Erro ao extrair dados do link.'
    };
  }
}

function isProductImage(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  
  const excludePatterns = [
    'logo', 'icon', 'avatar', 'banner', 'sprite', 'pixel', 'tracking',
    'analytics', 'facebook', 'twitter', 'instagram', 'social', 'badge',
    'button', 'arrow', 'loading', 'spinner', 'placeholder', 'blank',
    '1x1', 'spacer', 'transparent', 'advertisement', 'ad-', 'ads-',
    'favicon', 'emoji', 'svg', 'splash_screen', 'splash-screen',
    'ios_splash', 'android_splash', 'app_icon'
  ];
  
  for (const pattern of excludePatterns) {
    if (lowerUrl.includes(pattern)) {
      return false;
    }
  }
  
  return true;
}

function cleanImageUrl(url: string): string {
  try {
    return url
      .replace(/_tn\./g, '.')
      .replace(/\/tn\//g, '/')
      .replace(/_thumb/g, '')
      .replace(/_small/g, '')
      .replace(/_medium/g, '');
  } catch {
    return url;
  }
}
