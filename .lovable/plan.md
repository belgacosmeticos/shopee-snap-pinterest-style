## Ferramenta: TikTok Downloader (sem marca d'água + scraping de perfil)

### O que será construído

Nova aba "TikTok" no dashboard com **dois modos**:

1. **Modo Link Único**: cola URL de um vídeo TikTok → baixa sem marca d'água
2. **Modo Perfil**: cola `@usuario` ou URL do perfil → lista todos os vídeos com thumbnail, views, likes, descrição → permite **filtrar/ordenar** (mais vistos, mais recentes), **selecionar múltiplos** e **baixar todos** em lote (ZIP ou um a um)

### Pesquisa de APIs (concluída)

Avaliei as opções e a **melhor escolha é reutilizar o Apify** (já temos `APIFY_API_TOKEN` configurado no projeto, sem custo de nova chave):

| Opção | Prós | Contras |
|---|---|---|
| **Apify `novi/tiktok-user-api`** ✅ | Sem watermark, suporta `@username`/URL/userID, retorna views/likes/desc, já temos token | Pago por execução (Apify) |
| `omkarcloud/tiktok-scraper` | 5k req/mês grátis | Precisa de nova chave, menos maduro |
| TikWM / SnapTik APIs públicas | Grátis | Instáveis, rate-limit agressivo, quebram constantemente |

**Estratégia escolhida**: usar **Apify `novi/tiktok-user-api`** para perfis (já validado no VideoMiner com `tiktok-hashtag-scraper` da mesma família) e **TikWM como fallback grátis** para download de link único (mais leve/barato que rodar Apify pra 1 vídeo).

### Arquitetura

```text
Frontend (TikTokTool)
  ├─ Modo Link  → edge: tiktok-download-single  → TikWM API (grátis) → MP4 sem marca
  └─ Modo Perfil → edge: tiktok-scrape-profile  → Apify novi/tiktok-user-api → lista de vídeos
                                                                              ↓
                                          UI: filtros (views/data) + seleção múltipla
                                                                              ↓
                                              Download em lote (fetch direto das URLs)
```

### Arquivos a criar/modificar

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `supabase/functions/tiktok-download-single/index.ts` | Recebe URL, chama TikWM, retorna MP4 sem watermark |
| Criar | `supabase/functions/tiktok-scrape-profile/index.ts` | Recebe `@user` + limit, chama Apify actor `novi/tiktok-user-api`, retorna lista de vídeos |
| Modificar | `supabase/config.toml` | Registrar as 2 novas funções |
| Criar | `src/components/TikTokTool.tsx` | Componente principal (controla os 2 modos) |
| Criar | `src/components/steps/TikTokInputStep.tsx` | Input com toggle Link/Perfil |
| Criar | `src/components/steps/TikTokProfileResultStep.tsx` | Grid com vídeos, filtros (mais vistos/recentes), checkboxes, "baixar selecionados" |
| Criar | `src/components/steps/TikTokSingleResultStep.tsx` | Preview + download de 1 vídeo |
| Modificar | `src/components/ToolsDashboard.tsx` | Nova aba "TikTok" (grid 7→8 cols), ícone `Music2` |

### Detalhes técnicos

**Edge `tiktok-download-single`** (TikWM, grátis, sem chave):
```ts
POST https://www.tikwm.com/api/
body: { url: "<tiktok_url>", hd: 1 }
→ resposta: { data: { play: "<url_mp4_sem_watermark>", cover, title, ... } }
```

**Edge `tiktok-scrape-profile`** (Apify):
```ts
POST https://api.apify.com/v2/acts/novi~tiktok-user-api/run-sync-get-dataset-items
   ?token=APIFY_API_TOKEN
body: { usernames: ["@user"], limit: 50 }
→ array com download_url (sem watermark), play_count, digg_count, desc, cover, create_time
```

**Frontend - filtros/ordenação no perfil**:
- Sort: Mais vistos | Mais recentes | Mais curtidos
- Filtro por views mínimas (slider)
- "Selecionar todos" / seleção individual com checkbox
- Botão "Baixar selecionados" → loop pegando cada `download_url` via `fetch` + `URL.createObjectURL` (ou opcionalmente zipar com `jszip`)

**Tracking de uso**: integrar com `useUsageTracker` (`tool: 'tiktok'`, custType: `apify` para perfil, `free` para link único).

### Fluxo do usuário

```text
Modo Link:
1. Cola https://www.tiktok.com/@user/video/123
2. Clica "Baixar" → preview + botão download MP4

Modo Perfil:
1. Digita @nomeusuario (ou cola URL do perfil)
2. Define limite (ex: 30 vídeos) e clica "Buscar"
3. Vê grid com thumbnails + views/likes/data
4. Ordena por "Mais vistos", marca os 5 melhores
5. Clica "Baixar 5 selecionados" → baixa um por um
```

### Limitações

- Apify cobra por execução (~ centavos por scraping de perfil); link único usa TikWM grátis
- TikWM é grátis mas tem rate-limit (~1 req/seg); ok para uso individual
- Download em lote é sequencial via browser (não ZIP server-side, pra evitar custo de bandwidth na edge function)
