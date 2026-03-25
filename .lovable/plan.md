

## Ferramenta Shopee Scraper para Importacao Shopify

### O que sera construido

Uma nova aba "Shopify Scraper" no dashboard que permite:
1. Colar links de produtos Shopee um por um
2. Extrair automaticamente: titulo, imagens, descricao, preco (x2)
3. Acumular produtos numa lista editavel
4. Exportar como CSV no formato exato de importacao Shopify

### Como funciona

1. Usuario cola link da Shopee e clica "Adicionar"
2. Sistema usa a edge function `extract-shopee` existente para extrair dados (titulo, imagens, preco)
3. O produto aparece numa tabela editavel onde o usuario pode ajustar titulo, preco, etc
4. Ao final, clica "Exportar CSV" e recebe o arquivo no formato Shopify

### Formato CSV Shopify

Colunas principais do template de importacao:

```text
Handle, Title, Body (HTML), Vendor, Product Category, Type, Tags,
Published, Option1 Name, Option1 Value, Variant SKU, Variant Grams,
Variant Inventory Tracker, Variant Inventory Qty, Variant Inventory Policy,
Variant Fulfillment Service, Variant Price, Variant Compare At Price,
Variant Requires Shipping, Variant Taxable, Image Src, Image Position,
Status
```

- **Preco**: valor extraido x2
- **Imagens**: cada imagem gera uma linha adicional com mesmo Handle
- **Status**: "draft" por padrao
- **Published**: false por padrao

### Arquivos a criar/modificar

| Tipo | Arquivo | Descricao |
|------|---------|-----------|
| Criar | `src/components/ShopifyScraperTool.tsx` | Componente principal com lista de produtos e botao exportar |
| Criar | `src/components/steps/ShopifyScraperInput.tsx` | Input de URL + botao adicionar |
| Criar | `src/lib/shopifyCsvExport.ts` | Funcao para gerar CSV no formato Shopify |
| Modificar | `src/components/ToolsDashboard.tsx` | Adicionar aba "Shopify" com icone ShoppingBag |

### Detalhes Tecnicos

- Reutiliza a edge function `extract-shopee` ja existente (extrai titulo, imagens, preco)
- Precisa extrair **preco** alem de imagens - a funcao atual ja retorna `price` pela Affiliate API
- Estado dos produtos armazenado em memoria (useState) - nao precisa de banco
- Exportacao CSV gerada no frontend com download direto
- Cada produto com multiplas imagens gera N linhas no CSV (mesma Handle, Image Src diferente)
- Grid de tabs passa de 6 para 7 colunas

### Fluxo do usuario

```text
1. Abre aba "Shopify"
2. Cola link do produto Shopee
3. Clica "Adicionar" → extrai dados automaticamente
4. Produto aparece na lista com: titulo, preco original, preco x2, thumb
5. Pode editar titulo/preco na lista
6. Repete passos 2-5 para mais produtos
7. Clica "Exportar CSV Shopify"
8. Baixa arquivo .csv pronto para importar no Shopify
```

