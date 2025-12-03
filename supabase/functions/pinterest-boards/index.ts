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
    const { accessToken } = await req.json();

    if (!accessToken) {
      throw new Error('Access token is required');
    }

    console.log('[pinterest-boards] Fetching boards...');

    // Fetch user's boards from Pinterest API v5
    const boardsResponse = await fetch('https://api.pinterest.com/v5/boards?page_size=100', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const boardsData = await boardsResponse.json();

    console.log('[pinterest-boards] Response status:', boardsResponse.status);

    if (!boardsResponse.ok) {
      console.error('[pinterest-boards] API error:', boardsData);
      throw new Error(boardsData.message || 'Failed to fetch boards');
    }

    // Map boards to a simpler format
    const boards = (boardsData.items || []).map((board: any) => ({
      id: board.id,
      name: board.name,
      description: board.description,
      pinCount: board.pin_count,
      privacy: board.privacy,
      imageUrl: board.media?.image_cover_url || null,
    }));

    console.log('[pinterest-boards] Found', boards.length, 'boards');

    return new Response(
      JSON.stringify({ boards }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[pinterest-boards] Error:', error);
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
