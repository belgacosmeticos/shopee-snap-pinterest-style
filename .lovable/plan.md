

## Plano: Implementar Ferramenta Seedance 2.0

### Resumo

Adicionar uma nova aba "Seedance" ao dashboard que permite gerar videos com IA usando o modelo Seedance 2.0 da ByteDance, via API do xskill.ai.

---

### Pre-requisito

Sera necessario criar uma conta em [xskill.ai](https://www.xskill.ai/) e obter uma API Key. Vou solicitar o secret `XSKILL_API_KEY` antes de implementar.

---

### Arquivos a Criar

**1. `supabase/functions/seedance-create/index.ts`**
- Edge function que recebe prompt, media_files, aspect_ratio, duration
- Chama `POST https://api.xskill.ai/api/v3/tasks/create` com Bearer token
- Retorna o `task_id`

**2. `supabase/functions/seedance-query/index.ts`**
- Edge function que recebe `task_id`
- Chama `POST https://api.xskill.ai/api/v3/tasks/query`
- Retorna status e URL do video quando completo

**3. `src/components/SeedanceTool.tsx`**
- Componente principal da ferramenta
- Gerencia estados: input, generating, result

**4. `src/components/steps/SeedanceInputStep.tsx`**
- Campo de texto para o prompt
- Upload/URL de imagens e videos de referencia (opcional)
- Seletor de aspect ratio (16:9, 9:16, 1:1)
- Seletor de duracao (4-15 segundos)
- Seletor de modo (Fast/Standard)

**5. `src/components/steps/SeedanceResultStep.tsx`**
- Player de video com o resultado
- Botao de download
- Botao para gerar novo

---

### Arquivos a Modificar

**1. `src/components/ToolsDashboard.tsx`**
- Adicionar nova aba "Seedance" com icone de Clapperboard
- Grid passa de 5 para 6 colunas

**2. `supabase/config.toml`**
- Adicionar configuracao das duas novas functions com `verify_jwt = false`

---

### Fluxo da Ferramenta

```text
Tela de Input
  [Prompt: "Uma astronauta caminhando em Marte..."]
  [Imagens/Videos de referencia (opcional)]
  [Aspect Ratio: 16:9 | 9:16 | 1:1]
  [Duracao: 5s]
  [Modo: Fast | Standard]
  [Gerar Video]
        |
        v
Edge Function: seedance-create
  POST api.xskill.ai/api/v3/tasks/create
  -> retorna task_id
        |
        v
Tela de Loading (com polling)
  A cada 5 segundos:
  Edge Function: seedance-query
  POST api.xskill.ai/api/v3/tasks/query
  -> status: pending/processing/completed/failed
        |
        v
Tela de Resultado
  [Player de Video]
  [Baixar Video]
  [Gerar Novo]
```

---

### Detalhes Tecnicos

**Edge Function `seedance-create`:**
```typescript
// Recebe: { prompt, mediaFiles?, aspectRatio?, duration?, mode? }
// Chama: POST https://api.xskill.ai/api/v3/tasks/create
// Body: {
//   model: "st-ai/super-seed2",
//   params: {
//     prompt: "...",
//     media_files: [...],
//     aspect_ratio: "16:9",
//     duration: "5",
//     model: "Fast"
//   }
// }
// Retorna: { taskId, price }
```

**Edge Function `seedance-query`:**
```typescript
// Recebe: { taskId }
// Chama: POST https://api.xskill.ai/api/v3/tasks/query
// Retorna: { status, videoUrl? }
// status: "pending" | "processing" | "completed" | "failed"
```

**Frontend - Polling:**
- Apos criar task, faz polling a cada 5 segundos
- Mostra progresso visual (pending -> processing -> completed)
- Timeout de 3 minutos maximo
- Tratamento de erro se status = "failed"

**Sintaxe de referencia de midia:**
- O prompt suporta `@imagem1`, `@video1` para referenciar arquivos em media_files
- O frontend vai instruir o usuario sobre essa sintaxe

---

### Secret Necessario

- `XSKILL_API_KEY` - API Key obtida em xskill.ai

---

### Resumo de Mudancas

| Tipo | Arquivo | Descricao |
|------|---------|-----------|
| Criar | `supabase/functions/seedance-create/index.ts` | Criar task de geracao de video |
| Criar | `supabase/functions/seedance-query/index.ts` | Consultar status da task |
| Criar | `src/components/SeedanceTool.tsx` | Componente principal |
| Criar | `src/components/steps/SeedanceInputStep.tsx` | Tela de input |
| Criar | `src/components/steps/SeedanceResultStep.tsx` | Tela de resultado |
| Modificar | `src/components/ToolsDashboard.tsx` | Adicionar aba Seedance |
| Modificar | `supabase/config.toml` | Config das novas functions |

