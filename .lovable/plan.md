

## Implementar Ferramenta Seedance 2.0

### Passo 1: Configurar Secret
- Salvar `XSKILL_API_KEY` com o valor fornecido como secret do projeto

### Passo 2: Criar Edge Functions

**`supabase/functions/seedance-create/index.ts`**
- Recebe: prompt, mediaFiles (opcional), aspectRatio, duration, mode
- Chama POST `https://api.xskill.ai/api/v3/tasks/create` com Bearer token
- Body: model `st-ai/super-seed2`, params com prompt, media_files, aspect_ratio, duration, model (Fast/Standard)
- Retorna task_id e price

**`supabase/functions/seedance-query/index.ts`**
- Recebe: taskId
- Chama POST `https://api.xskill.ai/api/v3/tasks/query`
- Retorna status (pending/processing/completed/failed) e videoUrl quando completo

### Passo 3: Registrar Functions no config.toml
- Adicionar `[functions.seedance-create]` e `[functions.seedance-query]` com `verify_jwt = false`

### Passo 4: Criar Componentes Frontend

**`src/components/steps/SeedanceInputStep.tsx`**
- Campo de texto para prompt
- Campo para URLs de imagens/videos de referencia (opcional)
- Seletor de aspect ratio (16:9, 9:16, 1:1)
- Slider de duracao (5-10 segundos)
- Seletor de modo (Fast/Standard)
- Botao "Gerar Video"

**`src/components/steps/SeedanceResultStep.tsx`**
- Player de video com o resultado
- Botao de download
- Botao para gerar novo video

**`src/components/SeedanceTool.tsx`**
- Gerencia 3 estados: input, generating (com polling a cada 5s), result
- Tela de loading com barra de progresso e status atual
- Timeout de 3 minutos

### Passo 5: Integrar no Dashboard

**`src/components/ToolsDashboard.tsx`**
- Adicionar aba "Seedance" com icone Clapperboard
- Grid de tabs passa de 5 para 6 colunas

### Detalhes Tecnicos

- Polling a cada 5 segundos para consultar status da task
- Progresso visual: pending -> processing -> completed
- Timeout maximo de 3 minutos com mensagem de erro
- Tratamento de erro para status "failed"
- Sintaxe `@imagem1`, `@video1` no prompt para referenciar arquivos em media_files

| Tipo | Arquivo |
|------|---------|
| Secret | XSKILL_API_KEY |
| Criar | supabase/functions/seedance-create/index.ts |
| Criar | supabase/functions/seedance-query/index.ts |
| Criar | src/components/SeedanceTool.tsx |
| Criar | src/components/steps/SeedanceInputStep.tsx |
| Criar | src/components/steps/SeedanceResultStep.tsx |
| Modificar | src/components/ToolsDashboard.tsx |
| Modificar | supabase/config.toml |

