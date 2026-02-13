

## Plano: Corrigir Seedance + Upload de Midia + Duracao ate 15s

### Problemas Identificados

1. **Erro "Nenhum task_id retornado"**: A API xskill retornou `{}` (vazio). O problema e que a resposta da API provavelmente usa campos diferentes do esperado (ex: `id` em vez de `task_id`). Preciso adicionar logging para ver a resposta real e mapear corretamente.

2. **Upload de midia**: Atualmente so aceita URLs. O usuario quer poder subir imagens/videos por upload ou Ctrl+V (colar).

3. **Duracao**: O slider vai ate 10s, mas o Seedance 2.0 suporta ate 15s.

---

### Correcoes

**1. Edge Function `seedance-create/index.ts`**
- Adicionar `console.log` da resposta completa da API xskill para debug
- Mapear corretamente o campo do task_id (tentar `data.task_id`, `data.id`, `data.data?.task_id`)
- Retornar a resposta completa em caso de erro para facilitar debug

**2. Criar bucket de storage para midias**
- Criar um bucket publico `seedance-media` via migracao SQL
- Adicionar politica RLS para permitir upload anonimo (ferramenta nao usa auth)

**3. Criar Edge Function `seedance-upload/index.ts`**
- Recebe arquivo via FormData
- Faz upload para o bucket `seedance-media`
- Retorna URL publica do arquivo

**4. Atualizar `SeedanceInputStep.tsx`**
- Adicionar area de drag-and-drop e botao de upload de arquivo
- Suporte a Ctrl+V (paste) para colar imagens da area de transferencia
- Preview de imagens/videos adicionados (thumbnail)
- Manter opcao de URL tambem
- Alterar slider de duracao: min 5, max 15

**5. Atualizar `SeedanceTool.tsx`**
- Integrar upload: quando usuario sobe um arquivo, faz upload para storage e usa a URL publica como media_file

---

### Detalhes Tecnicos

**Bucket de Storage:**
```text
Nome: seedance-media
Publico: sim
RLS: permitir insert para todos (anon)
```

**Upload por Ctrl+V:**
- Listener de evento `paste` no componente
- Extrai imagem do clipboard (`clipboardData.items`)
- Faz upload automatico para o bucket
- Mostra preview inline

**Upload por arquivo:**
- Input type="file" aceita imagens e videos
- Tipos: image/*, video/*
- Faz upload para o bucket e usa a URL publica

**Duracao:**
- Slider min: 5s, max: 15s (ao inves de 10s)

---

### Arquivos a Modificar/Criar

| Tipo | Arquivo | Descricao |
|------|---------|-----------|
| Migracao SQL | Criar bucket seedance-media | Storage para uploads de midia |
| Modificar | `supabase/functions/seedance-create/index.ts` | Adicionar logging, fix task_id mapping |
| Modificar | `supabase/config.toml` | Registrar seedance-upload |
| Modificar | `src/components/steps/SeedanceInputStep.tsx` | Upload, paste, drag-drop, duracao 15s |
| Modificar | `src/components/SeedanceTool.tsx` | Integrar upload de arquivos |

