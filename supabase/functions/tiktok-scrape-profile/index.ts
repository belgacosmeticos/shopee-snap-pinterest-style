const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN');
    if (!APIFY_TOKEN) {
      return new Response(JSON.stringify({ error: 'APIFY_API_TOKEN não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { username, limit = 30 } = await req.json();
    if (!username || typeof username !== 'string') {
      return new Response(JSON.stringify({ error: 'username é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normaliza: aceita "@user", "user", ou URL completa
    let uname = username.trim();
    const urlMatch = uname.match(/tiktok\.com\/@([\w._-]+)/i);
    if (urlMatch) uname = urlMatch[1];
    uname = uname.replace(/^@/, '');

    console.log('[tiktok-scrape-profile] user:', uname, 'limit:', limit);

    const actorRes = await fetch(
      `https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: [uname],
          resultsPerPage: Math.min(Math.max(Number(limit) || 30, 1), 100),
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
        }),
      },
    );

    if (!actorRes.ok) {
      const text = await actorRes.text();
      console.error('[tiktok-scrape-profile] Apify error', actorRes.status, text);
      return new Response(
        JSON.stringify({ error: `Apify error ${actorRes.status}: ${text.slice(0, 300)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const items = (await actorRes.json()) as any[];
    console.log('[tiktok-scrape-profile] got', items.length, 'items');

    const videos = items.map((it: any) => ({
      id: it.id || it.videoMeta?.id,
      url: it.webVideoUrl,
      desc: it.text || '',
      cover: it.videoMeta?.coverUrl || it.videoMeta?.originalCoverUrl,
      downloadUrl: it.videoMeta?.downloadAddr || it.mediaUrls?.[0] || it.videoUrl,
      duration: it.videoMeta?.duration,
      createdAt: it.createTimeISO || (it.createTime ? new Date(it.createTime * 1000).toISOString() : null),
      stats: {
        plays: it.playCount || 0,
        likes: it.diggCount || 0,
        comments: it.commentCount || 0,
        shares: it.shareCount || 0,
      },
      author: {
        name: it.authorMeta?.name || uname,
        nickname: it.authorMeta?.nickName,
        avatar: it.authorMeta?.avatar,
      },
    })).filter(v => v.downloadUrl || v.url);

    return new Response(
      JSON.stringify({ success: true, username: uname, count: videos.length, videos }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[tiktok-scrape-profile] error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
