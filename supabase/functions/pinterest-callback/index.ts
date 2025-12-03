import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('[pinterest-callback] Received callback with code:', code ? 'yes' : 'no');

    if (error) {
      console.error('[pinterest-callback] OAuth error:', error);
      // Redirect back to app with error
      const redirectUrl = new URL(Deno.env.get('SITE_URL') || 'https://yypyrruejhrdxiifieao.lovableproject.com');
      redirectUrl.searchParams.set('pinterest_error', error);
      return Response.redirect(redirectUrl.toString(), 302);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    const PINTEREST_APP_ID = Deno.env.get('PINTEREST_APP_ID');
    const PINTEREST_APP_SECRET = Deno.env.get('PINTEREST_APP_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    if (!PINTEREST_APP_ID || !PINTEREST_APP_SECRET) {
      throw new Error('Pinterest credentials not configured');
    }

    // Exchange code for tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/pinterest-callback`;
    
    const tokenResponse = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    console.log('[pinterest-callback] Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('[pinterest-callback] Token error:', tokenData);
      throw new Error(tokenData.message || 'Failed to exchange code for token');
    }

    console.log('[pinterest-callback] Successfully obtained access token');

    // Redirect back to the app with the token in the URL hash (for client-side handling)
    const redirectUrl = new URL(Deno.env.get('SITE_URL') || 'https://yypyrruejhrdxiifieao.lovableproject.com');
    redirectUrl.hash = `pinterest_access_token=${tokenData.access_token}&pinterest_refresh_token=${tokenData.refresh_token || ''}&pinterest_expires_in=${tokenData.expires_in || 3600}`;

    return Response.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    console.error('[pinterest-callback] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const redirectUrl = new URL(Deno.env.get('SITE_URL') || 'https://yypyrruejhrdxiifieao.lovableproject.com');
    redirectUrl.searchParams.set('pinterest_error', errorMessage);
    return Response.redirect(redirectUrl.toString(), 302);
  }
});
