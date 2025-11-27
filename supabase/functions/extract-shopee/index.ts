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
    console.log('Extracting from Shopee URL:', url);

    if (!url || (!url.includes('shopee') && !url.includes('s.shopee'))) {
      return new Response(
        JSON.stringify({ error: 'URL inválida. Por favor, forneça um link válido da Shopee.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the Shopee page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const html = await response.text();
    console.log('HTML length:', html.length);

    // Extract images from the page
    const images: string[] = [];
    let title = '';

    // Try to extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const jsonData = JSON.parse(jsonContent);
          
          if (jsonData.image) {
            const imgArray = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
            images.push(...imgArray.filter((img: string) => img && img.startsWith('http')));
          }
          
          if (jsonData.name && !title) {
            title = jsonData.name;
          }
        } catch (e) {
          console.log('Error parsing JSON-LD:', e);
        }
      }
    }

    // Extract from og:image meta tags
    const ogImageMatches = html.matchAll(/property="og:image"[^>]*content="([^"]+)"/gi);
    for (const match of ogImageMatches) {
      if (match[1] && match[1].startsWith('http')) {
        images.push(match[1]);
      }
    }

    // Extract from og:title
    const ogTitleMatch = html.match(/property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch && !title) {
      title = ogTitleMatch[1];
    }

    // Extract from title tag
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(' | Shopee Brasil', '').replace(' | Shopee', '').trim();
      }
    }

    // Extract images from common Shopee patterns
    const imgMatches = html.matchAll(/https:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s]*)?/gi);
    for (const match of imgMatches) {
      const imgUrl = match[0];
      if (imgUrl.includes('cf.shopee') || imgUrl.includes('down-br.img.susercontent')) {
        // Convert thumbnail to full size
        const fullSizeUrl = imgUrl
          .replace(/_tn\./g, '.')
          .replace(/\/tn\//g, '/')
          .replace(/_thumb/g, '');
        if (!images.includes(fullSizeUrl)) {
          images.push(fullSizeUrl);
        }
      }
    }

    // Remove duplicates and limit to 10 images
    const uniqueImages = [...new Set(images)].slice(0, 10);
    
    console.log('Extracted title:', title);
    console.log('Extracted images count:', uniqueImages.length);

    return new Response(
      JSON.stringify({ 
        title: title || 'Produto Shopee',
        images: uniqueImages,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting Shopee data:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao extrair dados. Tente novamente.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
