

## Plano: Tornar Link do Produto Opcional no VideoGen

### Problema Identificado

A edge function `extract-shopee-video` funciona corretamente - testei com o link e retornou o vídeo sem marca d'água. O problema é que o frontend em `VideoUrlInputStep.tsx` exige obrigatoriamente o link do produto (linha 61-64).

### Mudanças Necessárias

| Arquivo | Mudança |
|---------|---------|
| `src/components/steps/VideoUrlInputStep.tsx` | Remover validação obrigatória do link do produto, ajustar lógica para pular extração do produto quando vazio |
| `src/components/steps/VideoResultStep.tsx` | Ajustar para exibir corretamente quando não há dados do produto |

---

### Correção 1: Tornar Link do Produto Opcional

**Arquivo:** `src/components/steps/VideoUrlInputStep.tsx`

**DE (linhas 60-64):**
```typescript
if (!productUrl.trim()) {
  setError('Por favor, insira o link do produto');
  return;
}
```

**PARA:**
```typescript
// Link do produto é opcional
const hasProductUrl = productUrl.trim().length > 0;
```

**Ajustar lógica de extração (linhas 75-93):**

```typescript
let productTitle = 'Vídeo Shopee';
let affiliateLink: string | undefined;
let originalLink: string | undefined;

if (hasProductUrl) {
  setExtractingProduct(true);
  console.log('[VideoUrlInputStep] Extracting product data from:', productUrl);
  const { data: productData, error: productError } = await supabase.functions.invoke('extract-shopee', {
    body: { url: productUrl }
  });
  setExtractingProduct(false);

  if (!productError && productData?.success) {
    productTitle = productData.title || 'Produto Shopee';
    affiliateLink = productData.affiliateLink;
    originalLink = productData.originalLink || productUrl;
  }
} else {
  // Sem link de produto, pular extração
  console.log('[VideoUrlInputStep] No product URL, skipping product extraction');
}
```

---

### Correção 2: Atualizar Labels e Placeholder

**Arquivo:** `src/components/steps/VideoUrlInputStep.tsx`

Atualizar o label para indicar que é opcional:

```tsx
<Label htmlFor="product-url" className="text-base font-medium flex items-center gap-2">
  <Link2 className="w-4 h-4 text-coral" />
  Link do Produto Shopee (opcional)
</Label>
```

Atualizar a descrição:

```tsx
<p className="text-xs text-muted-foreground">
  Opcional: Cole o link do produto para extrair nome e link de afiliado
</p>
```

---

### Correção 3: Ajustar VideoResultStep para Exibir Sem Produto

**Arquivo:** `src/components/steps/VideoResultStep.tsx`

Verificar se precisa de ajustes para quando `productData` não tem informações do produto (título genérico). O componente já deve lidar com isso, mas vou verificar se há lógica que depende dos dados do produto.

---

### Fluxo Atualizado

```
Usuário entra na ferramenta
         |
         v
+--------------------------------+
| Campos do formulário:          |
| - Link do Produto (OPCIONAL)   |
| - Links dos Vídeos (1-5)       |
+--------------------------------+
         |
         v
+--------------------------------+
| Validação:                     |
| - Pelo menos 1 link de vídeo   |
| - Link do produto pode ser     |
|   vazio                        |
+--------------------------------+
         |
    +----+----+
    |         |
    v         v
Com produto  Sem produto
    |         |
    v         v
Extrai       Pula extração,
produto      usa título genérico
    |         |
    +----+----+
         |
         v
+--------------------------------+
| Extrai vídeos sem marca d'água |
| via extract-shopee-video       |
+--------------------------------+
         |
         v
+--------------------------------+
| Exibe resultados               |
| (com ou sem dados do produto)  |
+--------------------------------+
```

---

### Resultado Esperado

- Usuário pode usar a ferramenta apenas para baixar vídeos sem marca d'água
- Link do produto é opcional e indicado claramente na interface
- Quando não há link do produto, a ferramenta ainda funciona normalmente com título genérico

