

## Plano: Extração Automática de Link de Afiliado + Sistema de Usuários

### Resumo

Vamos implementar duas funcionalidades:
1. **Extração automática de link de afiliado** do link do vídeo Shopee
2. **Sistema de dois usuários** com PINs diferentes e APIs Shopee diferentes

---

## Funcionalidade 1: Extração Automática de Link de Afiliado

### Como Funciona

Quando o usuário cola um link de vídeo Shopee (ex: `https://br.shp.ee/c1679w0?smtt=0.0.9`), o sistema irá:

1. Seguir os redirects do link curto
2. Identificar o `shop_id` e `item_id` do produto associado ao vídeo
3. Usar a API de Afiliados da Shopee para gerar o link de afiliado automaticamente
4. Retornar o link de afiliado junto com o vídeo sem marca d'água

### Mudanças Técnicas

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/extract-shopee-video/index.ts` | Adicionar extração de product ID do vídeo e geração de link de afiliado |
| `src/components/steps/VideoUrlInputStep.tsx` | Remover seção "Quer extrair link de afiliado?" (será automático) |
| `src/components/VideoGenTool.tsx` | Atualizar tipagem para incluir `affiliateLink` no retorno |
| `src/components/steps/VideoResultStep.tsx` | Exibir link de afiliado automaticamente quando disponível |

### Detalhes da Implementação

**Edge Function `extract-shopee-video`:**

```typescript
// Adicionar ao início do arquivo
async function generateAffiliateLink(appId: string, appSecret: string, originalUrl: string, userId?: string): Promise<string | null> {
  // Reutilizar lógica do extract-shopee
  // Usar userId como subId para rastrear qual usuário gerou o link
}

// Adicionar ao final de extractVideoInfo
async function extractVideoInfo(url: string, userId?: string): Promise<VideoInfo> {
  // ... código existente ...
  
  // NOVO: Tentar extrair link de afiliado do produto
  const appId = Deno.env.get('SHOPEE_APP_ID');
  const appSecret = Deno.env.get('SHOPEE_APP_SECRET');
  
  // Se for usuário Paula, usar credenciais diferentes
  const finalAppId = userId === 'paula' 
    ? Deno.env.get('SHOPEE_APP_ID_PAULA') 
    : appId;
  const finalAppSecret = userId === 'paula' 
    ? Deno.env.get('SHOPEE_APP_SECRET_PAULA') 
    : appSecret;
  
  if (finalAppId && finalAppSecret) {
    // Usar a URL final (sv.shopee) para gerar link de afiliado
    const affiliateLink = await generateAffiliateLink(finalAppId, finalAppSecret, svShopeeUrl || finalUrl, userId);
    if (affiliateLink) {
      result.affiliateLink = affiliateLink;
      result.productLink = svShopeeUrl || finalUrl;
    }
  }
  
  return result;
}
```

---

## Funcionalidade 2: Sistema de Dois Usuários

### Como Funciona

| PIN | Usuário | API Shopee |
|-----|---------|------------|
| `042721` | Usuário Padrão | `SHOPEE_APP_ID` + `SHOPEE_APP_SECRET` |
| `0131` | Paula | `SHOPEE_APP_ID_PAULA` + `SHOPEE_APP_SECRET_PAULA` |

### Mudanças Técnicas

| Arquivo | Mudança |
|---------|---------|
| `src/components/PinAuth.tsx` | Adicionar suporte a múltiplos PINs e identificar usuário |
| `src/hooks/useCurrentUser.ts` | Novo hook para gerenciar contexto do usuário atual |
| `src/components/steps/VideoUrlInputStep.tsx` | Passar `userId` para a edge function |
| `supabase/functions/extract-shopee-video/index.ts` | Usar credenciais corretas baseado no `userId` |

### Detalhes da Implementação

**1. Novo Hook `useCurrentUser.ts`:**

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const session = localStorage.getItem('shopee_tools_auth');
    if (session) {
      const data = JSON.parse(session);
      return data.user || null;
    }
    return null;
  });

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useCurrentUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useCurrentUser must be used within UserProvider');
  return context;
};
```

**2. Atualização do `PinAuth.tsx`:**

```typescript
const VALID_PINS: Record<string, { id: string; name: string }> = {
  '042721': { id: 'default', name: 'Usuário' },
  '0131': { id: 'paula', name: 'Paula' },
};

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  const userInfo = VALID_PINS[pin];
  
  if (userInfo) {
    const session = {
      authenticated: true,
      expiry: Date.now() + SESSION_DURATION,
      user: userInfo,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(userInfo); // Do contexto
    setIsAuthenticated(true);
    toast.success(`Bem-vinda, ${userInfo.name}! Sessão válida por 24 horas.`);
  } else {
    toast.error('PIN incorreto. Tente novamente.');
    setPin('');
  }
};
```

**3. Atualização do `VideoUrlInputStep.tsx`:**

```typescript
import { useCurrentUser } from '@/hooks/useCurrentUser';

export const VideoUrlInputStep = ({ ... }) => {
  const { user } = useCurrentUser();
  
  // Na chamada da edge function:
  const { data: videoData, error: videoError } = await supabase.functions.invoke('extract-shopee-video', {
    body: { 
      url: videoUrl,
      userId: user?.id // Passar ID do usuário
    }
  });
};
```

**4. Novos Secrets Necessários:**

Será necessário adicionar dois novos secrets para a Paula:
- `SHOPEE_APP_ID_PAULA`
- `SHOPEE_APP_SECRET_PAULA`

---

## Fluxo Atualizado

```text
┌──────────────────────────────────────┐
│        Tela de Login (PIN)           │
│                                      │
│  PIN: 042721 → Usuário Padrão        │
│  PIN: 0131   → Paula                 │
└──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│       Dashboard de Ferramentas       │
│      (exibe nome do usuário)         │
└──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│     VideoGen - Baixar Vídeos         │
│                                      │
│  [Cole os links dos vídeos...]       │
│                                      │
│  [Extrair Vídeos]                    │
└──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│   Edge Function: extract-shopee-video│
│                                      │
│  1. Extrair vídeo sem marca d'água   │
│  2. Identificar product_id           │
│  3. Gerar link de afiliado           │
│     (usando API do usuário correto)  │
└──────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────┐
│         Resultado                    │
│                                      │
│  📹 Vídeo sem marca d'água           │
│  💰 Link de Afiliado (automático!)   │
│  📋 Legenda                          │
│                                      │
│  [Baixar] [Compartilhar] [FB Reel]   │
└──────────────────────────────────────┘
```

---

## Resumo das Mudanças

### Arquivos a Criar
1. `src/hooks/useCurrentUser.tsx` - Contexto do usuário atual

### Arquivos a Modificar
1. `src/components/PinAuth.tsx` - Suporte a múltiplos PINs
2. `src/pages/Index.tsx` - Wrapping com UserProvider
3. `src/components/steps/VideoUrlInputStep.tsx` - Passar userId, remover seção opcional
4. `src/components/VideoGenTool.tsx` - Atualizar tipagem ExtractedVideo
5. `src/components/steps/VideoResultStep.tsx` - Exibir link de afiliado do vídeo
6. `supabase/functions/extract-shopee-video/index.ts` - Adicionar geração de link de afiliado

### Secrets a Adicionar
- `SHOPEE_APP_ID_PAULA`
- `SHOPEE_APP_SECRET_PAULA`

---

## Próximos Passos

Após aprovação, vou:
1. Solicitar que você adicione os secrets `SHOPEE_APP_ID_PAULA` e `SHOPEE_APP_SECRET_PAULA`
2. Implementar as mudanças em código

