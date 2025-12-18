import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productTitle, videoTitle, platform, rewriteTitle, originalTitle, rewriteCaption, originalCaption } = await req.json();
    
    console.log('[generate-video-caption] Input:', { productTitle, videoTitle, platform, rewriteTitle, rewriteCaption });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let prompt: string;
    let responseKey: string;

    if (rewriteTitle && originalTitle) {
      // Rewrite title keeping 99% of the idea
      prompt = `Reescreva este título de produto mantendo 99% da ideia original, apenas variando palavras e estrutura para não ficar idêntico:

Título original: "${originalTitle}"

REGRAS:
- Mantenha TODAS as informações importantes (marca, modelo, características)
- Apenas varie a ordem das palavras ou use sinônimos
- Mantenha o mesmo comprimento aproximado
- NÃO adicione informações novas
- NÃO remova informações importantes

Responda APENAS com o título reescrito, sem explicações.`;
      responseKey = 'rewrittenTitle';
    } else if (rewriteCaption && originalCaption) {
      // Rewrite caption keeping 99% of the idea
      prompt = `Reescreva esta legenda mantendo 99% da ideia original, apenas variando palavras para não ficar idêntica ao postar várias vezes:

Legenda original: "${originalCaption}"

REGRAS:
- Mantenha o mesmo tom e estilo
- Mantenha emojis e hashtags similares
- Apenas varie palavras e estrutura da frase
- Mantenha o CTA (call to action) se houver
- NÃO mude o sentido da mensagem

Responda APENAS com a legenda reescrita, sem explicações.`;
      responseKey = 'rewrittenCaption';
    } else {
      // Generate new caption for platform
      const platformInstructions = platform === 'facebook' 
        ? `Para Facebook Reels:
- Use emojis relevantes mas não em excesso
- Inclua uma chamada para ação clara
- Mencione o benefício principal do produto
- Use hashtags populares no final (3-5 hashtags)
- Tom mais conversacional e direto`
        : `Para Pinterest:
- Use palavras-chave relevantes naturalmente
- Inclua emojis para destaque visual
- Foque nos benefícios e uso do produto
- Hashtags no final (3-5 hashtags relevantes)
- Tom inspiracional e aspiracional`;

      prompt = `Crie uma legenda viral para um vídeo de afiliado sobre o produto: "${productTitle}"
${videoTitle ? `O vídeo mostra: "${videoTitle}"` : ''}

${platformInstructions}

IMPORTANTE:
- A legenda deve ser em português brasileiro
- Máximo 200 caracteres antes das hashtags
- Gere interesse e curiosidade
- Inclua CTA como "Link na bio" ou "Confira o link"

Responda APENAS com a legenda, sem explicações adicionais.`;
      responseKey = 'caption';
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um especialista em marketing de afiliados e criação de conteúdo viral para redes sociais. Responda apenas com o texto solicitado, sem explicações.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-video-caption] AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content?.trim();

    console.log('[generate-video-caption] Generated:', responseKey, generatedText);

    return new Response(
      JSON.stringify({ [responseKey]: generatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-video-caption] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
