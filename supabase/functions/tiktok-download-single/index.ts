const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'URL é obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[tiktok-download-single] fetching', url);

    const form = new URLSearchParams();
    form.append('url', url);
    form.append('hd', '1');

    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const json = await res.json();
    console.log('[tiktok-download-single] tikwm response code:', json?.code);

    if (json?.code !== 0 || !json?.data) {
      return new Response(
        JSON.stringify({ error: json?.msg || 'Falha ao baixar vídeo do TikTok' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const d = json.data;
    return new Response(
      JSON.stringify({
        success: true,
        video: {
          id: d.id,
          title: d.title,
          cover: d.cover || d.origin_cover,
          downloadUrl: d.hdplay || d.play, // sem watermark
          watermarkUrl: d.wmplay,
          duration: d.duration,
          author: d.author,
          stats: {
            plays: d.play_count,
            likes: d.digg_count,
            comments: d.comment_count,
            shares: d.share_count,
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[tiktok-download-single] error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
