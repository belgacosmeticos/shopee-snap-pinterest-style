## Por que o vídeo não toca

Inspecionei o MP4 baixado:
- Codec: **HEVC (H.265)** — não tocado nativamente em vários browsers/players
- **Sem stream de áudio**
- Resolução 1080x1920, 34s, válido tecnicamente

A causa é o parâmetro `hd=1` que estamos mandando pra API tikwm: ela responde com `hdplay` (HEVC, sem áudio). O campo `play` retorna H.264 com áudio — compatível em todo lugar.

## Correção

Em `supabase/functions/tiktok-proxy-download/index.ts`:
- Trocar `hd: '1'` por `hd: '0'` na chamada ao tikwm
- Trocar a ordem de prioridade de `j.data.hdplay || j.data.play` para `j.data.play || j.data.wmplay || j.data.hdplay`

Isso entrega o MP4 H.264 padrão (sem marca d'água, com áudio) que toca em qualquer lugar.

Sem mudanças no frontend.
