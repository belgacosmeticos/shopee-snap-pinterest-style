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
    const { accessToken, boardId, title, description, link, imageBase64 } = await req.json();

    if (!accessToken) {
      throw new Error('Access token is required');
    }
    if (!boardId) {
      throw new Error('Board ID is required');
    }
    if (!imageBase64) {
      throw new Error('Image is required');
    }

    console.log('[pinterest-create-pin] Creating pin on board:', boardId);

    // Extract base64 data (remove data:image/xxx;base64, prefix if present)
    let base64Data = imageBase64;
    if (imageBase64.includes(',')) {
      base64Data = imageBase64.split(',')[1];
    }

    // Create pin using Pinterest API v5
    const pinPayload: any = {
      board_id: boardId,
      media_source: {
        source_type: 'image_base64',
        content_type: 'image/png',
        data: base64Data,
      },
    };

    if (title) {
      pinPayload.title = title.substring(0, 100); // Pinterest title limit
    }

    if (description) {
      pinPayload.description = description.substring(0, 500); // Pinterest description limit
    }

    if (link) {
      pinPayload.link = link;
    }

    console.log('[pinterest-create-pin] Sending request to Pinterest API...');

    const createResponse = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pinPayload),
    });

    const pinData = await createResponse.json();

    console.log('[pinterest-create-pin] Response status:', createResponse.status);

    if (!createResponse.ok) {
      console.error('[pinterest-create-pin] API error:', pinData);
      throw new Error(pinData.message || `Failed to create pin: ${createResponse.status}`);
    }

    console.log('[pinterest-create-pin] Pin created successfully:', pinData.id);

    return new Response(
      JSON.stringify({
        success: true,
        pin: {
          id: pinData.id,
          link: pinData.link,
          title: pinData.title,
          description: pinData.description,
          boardId: pinData.board_id,
          createdAt: pinData.created_at,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[pinterest-create-pin] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
