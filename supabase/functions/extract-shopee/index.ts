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

    const isShopeeUrl = url.includes('shopee.com') || url.includes('s.shopee');

    if (isShopeeUrl) {
      const result = await extractFromShopee(url);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

async function generateShopeeSignature(appId: string, timestamp: number, payload: string, secret: string): Promise<string> {
  const signatureString = `${appId}${timestamp}${payload}${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function extractFromShopee(url: string): Promise<{ title: string; images: string[]; success: boolean; error?: string }> {
  console.log('Detected Shopee URL, extracting product data...');

  const appId = Deno.env.get('SHOPEE_APP_ID');
  const appSecret = Deno.env.get('SHOPEE_APP_SECRET');

  try {
    // Step 1: Follow redirects to get final URL
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

    // Step 2: Extract product name from URL
    let productName = '';
    const urlPath = new URL(finalUrl).pathname;
    const pathMatch = urlPath.match(/\/([^\/]+)-i\.\d+\.\d+/);
    if (pathMatch) {
      productName = decodeURIComponent(pathMatch[1]).replace(/-/g, ' ');
      console.log('Extracted product name from URL:', productName);
    }

    // Step 3: Extract item_id and shop_id from URL
    let itemId: string | null = null;
    let shopId: string | null = null;

    let match = finalUrl.match(/i\.(\d+)\.(\d+)/);
    if (match) {
      shopId = match[1];
      itemId = match[2];
      console.log('Pattern matched: i.SHOP_ID.ITEM_ID');
    }

    if (!itemId) {
      match = finalUrl.match(/\/[a-zA-Z]+\/(\d+)\/(\d+)/);
      if (match) {
        shopId = match[1];
        itemId = match[2];
        console.log('Pattern matched: /SELLER/SHOP_ID/ITEM_ID');
      }
    }

    console.log('Extracted IDs - shopId:', shopId, 'itemId:', itemId);

    // PRIORITY 1: Try direct Shopee API first (can get ALL gallery images)
    if (itemId && shopId) {
      console.log('🔍 PRIORITY 1: Trying Shopee internal API for gallery images...');
      const mobileResult = await tryShopeeApi(itemId, shopId, finalUrl);
      if (mobileResult.images.length > 0) {
        console.log('✅ SUCCESS: Got', mobileResult.images.length, 'gallery images from internal API');
        return mobileResult;
      }
      console.log('❌ Internal API failed, trying fallbacks...');
    }

    // PRIORITY 2: Try Affiliate API with exact product filtering
    if (appId && appSecret && itemId) {
      console.log('🔍 PRIORITY 2: Trying Affiliate API with exact product filter...');
      
      // First try with shopId to get shop products, then filter by itemId
      if (shopId) {
        const affiliateResult = await searchWithAffiliateApi(appId, appSecret, '', shopId, itemId);
        if (affiliateResult.images.length > 0) {
          console.log('✅ SUCCESS: Got exact product from Affiliate API');
          return affiliateResult;
        }
      }
      
      // Try with keyword if we have product name
      if (productName) {
        const affiliateResult = await searchWithAffiliateApi(appId, appSecret, productName.substring(0, 50), null, itemId);
        if (affiliateResult.images.length > 0) {
          console.log('✅ SUCCESS: Got product from Affiliate API keyword search');
          return affiliateResult;
        }
      }
    }

    // If all else fails
    return {
      title: productName || 'Produto Shopee',
      images: [],
      success: false,
      error: 'Não foi possível extrair imagens deste produto. A Shopee bloqueia requisições automáticas.'
    };

  } catch (error) {
    console.error('Error in Shopee extraction:', error);
    return {
      title: 'Produto Shopee',
      images: [],
      success: false,
      error: 'Erro ao extrair dados do produto.'
    };
  }
}

async function searchWithAffiliateApi(appId: string, appSecret: string, keyword: string, shopId: string | null, itemId: string | null): Promise<{ title: string; images: string[]; success: boolean }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    
    let queryParams = '';
    if (keyword) {
      queryParams = `keyword: "${keyword}"`;
    }
    if (shopId) {
      queryParams += queryParams ? ', ' : '';
      queryParams += `shopId: ${shopId}`;
    }
    
    const graphqlQuery = {
      query: `query {
        productOfferV2(
          ${queryParams}
          listType: 0
          sortType: 1
          page: 0
          limit: 50
        ) {
          nodes {
            productName
            imageUrl
            price
            commissionRate
            productLink
          }
        }
      }`
    };

    const payload = JSON.stringify(graphqlQuery);
    const signature = await generateShopeeSignature(appId, timestamp, payload, appSecret);

    console.log('Calling Shopee Affiliate API...');

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

    if (!apiResponse.ok) {
      console.error('Shopee Affiliate API error:', responseText);
      return { title: '', images: [], success: false };
    }

    const apiData = JSON.parse(responseText);
    
    if (apiData.errors && apiData.errors.length > 0) {
      console.error('GraphQL errors:', apiData.errors);
      return { title: '', images: [], success: false };
    }

    const products = apiData.data?.productOfferV2?.nodes;
    if (!products || products.length === 0) {
      console.log('No products found in API response');
      return { title: '', images: [], success: false };
    }

    console.log('Found', products.length, 'products from Affiliate API');

    // CRITICAL: Filter to find the EXACT product by itemId
    if (itemId) {
      const exactProduct = products.find((p: any) => 
        p.productLink && p.productLink.includes(itemId)
      );

      if (exactProduct) {
        console.log('✅ Found exact product match by itemId:', exactProduct.productName);
        return {
          title: exactProduct.productName || '',
          images: exactProduct.imageUrl ? [exactProduct.imageUrl] : [],
          success: true
        };
      } else {
        console.log('⚠️ No exact match found for itemId:', itemId);
        // Return empty if we can't find exact match - don't return wrong products
        return { title: '', images: [], success: false };
      }
    }

    // If no itemId filter, return first product (less ideal)
    const firstProduct = products[0];
    return {
      title: firstProduct.productName || '',
      images: firstProduct.imageUrl ? [firstProduct.imageUrl] : [],
      success: true
    };

  } catch (error) {
    console.error('Error in Affiliate API search:', error);
    return { title: '', images: [], success: false };
  }
}

async function tryShopeeApi(itemId: string, shopId: string, referer: string): Promise<{ title: string; images: string[]; success: boolean }> {
  // Different User-Agent strategies
  const userAgents = [
    // Mobile Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    // Android Chrome
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    // Desktop Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Googlebot (sometimes works)
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ];

  // Multiple endpoint strategies
  const endpoints = [
    {
      url: `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
      name: 'v4/item/get'
    },
    {
      url: `https://shopee.com.br/api/v4/pdp/get_pc?item_id=${itemId}&shop_id=${shopId}`,
      name: 'v4/pdp/get_pc'
    },
    {
      url: `https://shopee.com.br/api/v2/item/get?itemid=${itemId}&shopid=${shopId}`,
      name: 'v2/item/get'
    },
  ];

  for (const ua of userAgents) {
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying ${endpoint.name} with UA: ${ua.substring(0, 30)}...`);
        
        const apiResponse = await fetch(endpoint.url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Referer': referer,
            'x-shopee-language': 'pt-BR',
            'x-api-source': 'pc',
            'x-requested-with': 'XMLHttpRequest',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
          },
        });

        if (!apiResponse.ok) {
          console.log(`${endpoint.name} returned status:`, apiResponse.status);
          continue;
        }

        const apiData = await apiResponse.json();
        
        // Check for error in response
        if (apiData.error || apiData.error_msg) {
          console.log(`${endpoint.name} error:`, apiData.error_msg || apiData.error);
          continue;
        }

        const itemData = apiData.data || apiData.item || apiData;
        
        if (itemData) {
          const title = itemData.name || itemData.title || '';
          const images: string[] = [];

          // Main image
          if (itemData.image) {
            const imgUrl = itemData.image.startsWith('http') 
              ? itemData.image 
              : `https://cf.shopee.com.br/file/${itemData.image}`;
            images.push(imgUrl);
          }

          // Gallery images - THIS IS WHAT WE WANT
          if (itemData.images && Array.isArray(itemData.images)) {
            console.log('🎉 Found gallery images array with', itemData.images.length, 'images');
            for (const imgId of itemData.images) {
              const imgUrl = typeof imgId === 'string' && imgId.startsWith('http')
                ? imgId
                : `https://cf.shopee.com.br/file/${imgId}`;
              if (!images.includes(imgUrl)) {
                images.push(imgUrl);
              }
            }
          }

          // Model images (variants/colors)
          if (itemData.tier_variations && Array.isArray(itemData.tier_variations)) {
            for (const variation of itemData.tier_variations) {
              if (variation.images && Array.isArray(variation.images)) {
                console.log('🎨 Found variation images:', variation.images.length);
                for (const imgId of variation.images) {
                  if (imgId) {
                    const imgUrl = typeof imgId === 'string' && imgId.startsWith('http')
                      ? imgId
                      : `https://cf.shopee.com.br/file/${imgId}`;
                    if (!images.includes(imgUrl)) {
                      images.push(imgUrl);
                    }
                  }
                }
              }
            }
          }

          if (images.length > 0) {
            console.log(`✅ SUCCESS with ${endpoint.name}: Found ${images.length} total images`);
            return {
              title: title,
              images: images,
              success: true
            };
          }
        }
      } catch (error) {
        console.log(`Error with ${endpoint.name}:`, error);
        continue;
      }
    }
  }

  console.log('❌ All Shopee API attempts failed');
  return { title: '', images: [], success: false };
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
    const images: string[] = [];
    let title = '';

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

    const ogImageMatches = html.matchAll(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi);
    for (const match of ogImageMatches) {
      if (match[1] && match[1].startsWith('http') && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }

    const ogImageMatches2 = html.matchAll(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/gi);
    for (const match of ogImageMatches2) {
      if (match[1] && match[1].startsWith('http') && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }

    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && !title) {
      title = ogTitleMatch[1];
    }

    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*[\||\-]\s*.*$/i, '').trim();
      }
    }

    const imgTagMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgTagMatches) {
      const imgUrl = match[1];
      if (imgUrl && imgUrl.startsWith('http') && isProductImage(imgUrl) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    const uniqueImages = [...new Set(images)]
      .map(img => cleanImageUrl(img))
      .filter(img => img && img.length > 10 && isProductImage(img))
      .slice(0, 15);

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
    'favicon', 'emoji', 'svg', 'splash_screen', 'splash-screen'
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
      .replace(/_medium/g, '')
      .replace(/\?.*$/, '');
  } catch {
    return url;
  }
}
