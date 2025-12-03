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
    const PINTEREST_APP_ID = Deno.env.get('PINTEREST_APP_ID');
    
    if (!PINTEREST_APP_ID) {
      throw new Error('Pinterest App ID not configured');
    }

    const { redirectUri } = await req.json();

    if (!redirectUri) {
      throw new Error('Redirect URI is required');
    }

    // Pinterest OAuth2 authorization URL
    const scopes = 'boards:read,pins:read,pins:write,user_accounts:read';
    
    const authUrl = new URL('https://www.pinterest.com/oauth/');
    authUrl.searchParams.set('client_id', PINTEREST_APP_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', crypto.randomUUID());

    console.log('[pinterest-auth] Generated auth URL for redirect:', redirectUri);

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[pinterest-auth] Error:', error);
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
