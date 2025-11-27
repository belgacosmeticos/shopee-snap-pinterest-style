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
    const { productTitle, sceneDescription } = await req.json();
    console.log('Generating caption for:', productTitle);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const prompt = `Você é um especialista em marketing de moda no Pinterest. Crie um título e uma descrição otimizados para Pinterest para o seguinte produto:

Produto: ${productTitle}
Cenário da foto: ${sceneDescription || 'foto estilizada de moda'}

Regras:
- O título deve ter no máximo 100 caracteres
- A descrição deve ter entre 100-300 caracteres
- Use palavras-chave relevantes para SEO no Pinterest
- Inclua hashtags populares no final da descrição
- O tom deve ser aspiracional e engajador
- Foque em lifestyle, não em vendas diretas
- Use emojis de forma estratégica

Responda EXATAMENTE neste formato JSON:
{
  "title": "título aqui",
  "description": "descrição aqui com hashtags"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log('AI Response:', content);

    // Parse the JSON response
    let title = '';
    let description = '';

    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        title = parsed.title || '';
        description = parsed.description || '';
      }
    } catch (e) {
      console.log('Failed to parse JSON, using fallback');
      // Fallback: generate simple caption
      title = `✨ ${productTitle.slice(0, 80)}`;
      description = `Look inspirador com ${productTitle}. Perfeito para o seu dia a dia! 💫 #moda #fashion #style #ootd #lookdodia`;
    }

    return new Response(
      JSON.stringify({ 
        title,
        description,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating caption:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar legenda. Tente novamente.';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
