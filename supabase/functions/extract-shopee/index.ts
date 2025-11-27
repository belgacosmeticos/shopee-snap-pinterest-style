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

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    console.log('HTML length:', html.length);
    console.log('Final URL:', response.url);

    // Extract images from the page
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
        console.log('Error parsing JSON-LD:', e);
      }
    }

    // Extract from og:image meta tags
    const ogImageMatches = html.matchAll(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi);
    for (const match of ogImageMatches) {
      if (match[1] && match[1].startsWith('http') && !images.includes(match[1])) {
        images.push(match[1]);
      }
    }

    // Also try reverse order (content before property)
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
        title = titleMatch[1]
          .replace(/\s*[\||\-]\s*Shopee.*$/i, '')
          .replace(/\s*[\||\-]\s*.*$/i, '')
          .trim();
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

    // Extract from data-src attributes (lazy loaded images)
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

    // Extract any image URL patterns from the page
    const imageUrlMatches = html.matchAll(/https?:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s<>]*)?/gi);
    for (const match of imageUrlMatches) {
      const imgUrl = match[0];
      if (isProductImage(imgUrl) && !images.includes(imgUrl)) {
        images.push(imgUrl);
      }
    }

    // Remove duplicates and clean URLs
    const uniqueImages = [...new Set(images)]
      .map(img => cleanImageUrl(img))
      .filter(img => img && img.length > 10)
      .slice(0, 15);
    
    console.log('Extracted title:', title);
    console.log('Extracted images count:', uniqueImages.length);
    console.log('Sample images:', uniqueImages.slice(0, 3));

    return new Response(
      JSON.stringify({ 
        title: title || 'Produto',
        images: uniqueImages,
        success: true 
      }),
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

// Helper to filter product-like images
function isProductImage(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  
  // Exclude common non-product patterns
  const excludePatterns = [
    'logo', 'icon', 'avatar', 'banner', 'sprite', 'pixel', 'tracking',
    'analytics', 'facebook', 'twitter', 'instagram', 'social', 'badge',
    'button', 'arrow', 'loading', 'spinner', 'placeholder', 'blank',
    '1x1', 'spacer', 'transparent', 'advertisement', 'ad-', 'ads-',
    'favicon', 'emoji', 'svg'
  ];
  
  for (const pattern of excludePatterns) {
    if (lowerUrl.includes(pattern)) {
      return false;
    }
  }
  
  // Prefer larger images (common patterns for product images)
  const productPatterns = [
    'product', 'item', 'goods', 'img', 'image', 'photo', 'pic',
    'cdn', 'media', 'upload', 'static', 'assets'
  ];
  
  for (const pattern of productPatterns) {
    if (lowerUrl.includes(pattern)) {
      return true;
    }
  }
  
  return true; // Default to including if no exclusion matched
}

// Clean and normalize image URLs
function cleanImageUrl(url: string): string {
  try {
    // Remove thumbnail indicators and get full size
    let cleanUrl = url
      .replace(/_tn\./g, '.')
      .replace(/\/tn\//g, '/')
      .replace(/_thumb/g, '')
      .replace(/_small/g, '')
      .replace(/_medium/g, '')
      .replace(/\?.*$/, ''); // Remove query params that might resize
    
    return cleanUrl;
  } catch {
    return url;
  }
}
