import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SCENE_PROMPTS = [
  "fashion photoshoot in a minimalist studio with soft natural lighting, professional model wearing the outfit, aesthetic pinterest style, high quality editorial photo",
  "street style photography in Paris, elegant urban background with cafe, model wearing the clothing, golden hour lighting, pinterest aesthetic",
  "cozy bedroom flat lay with the clothing item beautifully arranged, dried flowers, coffee cup, aesthetic instagram style",
  "outdoor lifestyle photo in a beautiful garden, model wearing the outfit, soft bokeh background, pinterest viral style",
  "clean white marble background product photography, the clothing item elegantly displayed, luxury aesthetic, high end fashion",
  "beach sunset photoshoot, model wearing the outfit, warm golden tones, vacation vibes, pinterest travel aesthetic",
  "modern apartment interior, model casually styled wearing the clothing, natural window light, lifestyle photography",
  "autumn fashion shoot in a park with fall foliage, model wearing the outfit, warm cozy aesthetic, pinterest style",
  "rooftop photoshoot at golden hour, city skyline background, model in the outfit, editorial fashion style",
  "boutique store setting, elegant mannequin display, soft ambient lighting, luxury fashion aesthetic"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, productTitle, customPrompt, sceneIndex } = await req.json();
    console.log('Generating Pinterest image for:', productTitle);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Select scene prompt
    const selectedScene = sceneIndex !== undefined && sceneIndex >= 0 
      ? SCENE_PROMPTS[sceneIndex % SCENE_PROMPTS.length]
      : SCENE_PROMPTS[Math.floor(Math.random() * SCENE_PROMPTS.length)];

    // Build the prompt
    const basePrompt = customPrompt || selectedScene;
    const fullPrompt = `Create a stunning Pinterest-worthy fashion photo. Product: ${productTitle}. Style: ${basePrompt}. The image should be vertical (9:16 aspect ratio), highly aesthetic, with professional lighting and composition that would go viral on Pinterest. Make it look like a real professional photoshoot, not AI generated. Ultra high resolution, fashion magazine quality.`;

    console.log('Full prompt:', fullPrompt);

    // Generate image using Nano Banana model
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: imageUrl 
              ? [
                  { type: 'text', text: fullPrompt },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              : fullPrompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Aguarde um momento e tente novamente.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Response structure:', JSON.stringify(data, null, 2));

    // Try multiple paths to find the generated image
    let generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    // Alternative path: check if image is directly in the message
    if (!generatedImage) {
      generatedImage = data.choices?.[0]?.message?.images?.[0]?.url;
    }
    
    // Another alternative: check for inline_data format
    if (!generatedImage && data.choices?.[0]?.message?.images?.[0]?.inline_data) {
      const inlineData = data.choices[0].message.images[0].inline_data;
      generatedImage = `data:${inlineData.mime_type};base64,${inlineData.data}`;
    }
    
    if (!generatedImage) {
      console.error('No image found in response. Full response:', JSON.stringify(data));
      throw new Error('No image generated - check logs for response structure');
    }

    return new Response(
      JSON.stringify({ 
        image: generatedImage,
        sceneUsed: selectedScene,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar imagem. Tente novamente.';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
