const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-length, content-type',
};

async function resolveTikTokMp4(input: string): Promise<string> {
  // Se já é um .mp4 direto, usa
  if (/\.mp4(\?|$)/i.test(input)) return input;
  // Se é uma URL do TikTok (web), resolve via tikwm
  const form = new URLSearchParams();
  form.append('url', input);
  form.append('hd', '1');
  const r = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const j = await r.json();
  if (j?.code !== 0 || !j?.data) {
    throw new Error(j?.msg || 'Falha ao resolver MP4 do TikTok');
  }
  const mp4 = j.data.hdplay || j.data.play;
  if (!mp4) throw new Error('MP4 não encontrado na resposta');
  return mp4.startsWith('http') ? mp4 : `https://www.tikwm.com${mp4}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const videoUrl = url.searchParams.get('url');
    if (!videoUrl || videoUrl === 'undefined' || videoUrl === 'null') {
      return new Response(JSON.stringify({ error: 'url é obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[tiktok-proxy-download] resolving', videoUrl);
    const mp4Url = await resolveTikTokMp4(videoUrl);
    console.log('[tiktok-proxy-download] streaming', mp4Url);

    const upstream = await fetch(mp4Url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      console.error('[tiktok-proxy-download] upstream falhou', upstream.status, text.slice(0, 200));
      return new Response(
        JSON.stringify({ error: `Upstream ${upstream.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    const len = upstream.headers.get('content-length');
    if (len) headers.set('Content-Length', len);
    headers.set('Content-Disposition', 'attachment; filename="tiktok.mp4"');

    return new Response(upstream.body, { headers });
  } catch (err) {
    console.error('[tiktok-proxy-download] error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
