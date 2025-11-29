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

// PNG chunk types to keep (essential for image display)
const ESSENTIAL_CHUNKS = new Set([
  'IHDR', // Image header
  'PLTE', // Palette
  'IDAT', // Image data
  'IEND', // Image end
  'tRNS', // Transparency
  'gAMA', // Gamma
  'cHRM', // Chromaticity
  'sRGB', // sRGB color space
  'iCCP', // ICC profile (keep for color accuracy)
  'sBIT', // Significant bits
  'bKGD', // Background color
  'pHYs', // Physical pixel dimensions
]);

// Chunks to remove (contain AI metadata)
const METADATA_CHUNKS = new Set([
  'iTXt', // International text (XMP, contains "trainedAlgorithmicMedia")
  'tEXt', // Text (contains "Made with Google AI")
  'zTXt', // Compressed text
  'eXIf', // EXIF data
  'caBX', // C2PA Content Box
  'jumd', // JUMBF (C2PA manifest)
  'jumb', // JUMBF container
]);

function stripPngMetadata(base64Image: string): string {
  try {
    // Handle data URL format
    let base64Data = base64Image;
    let prefix = '';
    
    if (base64Image.startsWith('data:')) {
      const commaIndex = base64Image.indexOf(',');
      if (commaIndex !== -1) {
        prefix = base64Image.substring(0, commaIndex + 1);
        base64Data = base64Image.substring(commaIndex + 1);
      }
    }

    // Decode base64 to bytes
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Verify PNG signature (89 50 4E 47 0D 0A 1A 0A)
    const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== PNG_SIGNATURE[i]) {
        console.log('Not a valid PNG, skipping metadata strip');
        return base64Image;
      }
    }

    // Parse and filter chunks
    const cleanChunks: Uint8Array[] = [];
    
    // Keep PNG signature
    cleanChunks.push(bytes.slice(0, 8));

    let offset = 8;
    let removedChunks: string[] = [];

    while (offset < bytes.length) {
      // Read chunk length (4 bytes, big-endian)
      const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
      
      // Read chunk type (4 bytes ASCII)
      const typeBytes = bytes.slice(offset + 4, offset + 8);
      const chunkType = String.fromCharCode(...typeBytes);

      // Total chunk size: 4 (length) + 4 (type) + length (data) + 4 (CRC)
      const chunkSize = 12 + length;

      if (offset + chunkSize > bytes.length) {
        console.log('Chunk extends beyond file, stopping');
        break;
      }

      // Decide whether to keep or remove
      if (METADATA_CHUNKS.has(chunkType) || (!ESSENTIAL_CHUNKS.has(chunkType) && chunkType.charAt(0) === chunkType.charAt(0).toLowerCase())) {
        // Remove ancillary chunks that might contain metadata
        removedChunks.push(chunkType);
      } else {
        // Keep this chunk
        cleanChunks.push(bytes.slice(offset, offset + chunkSize));
      }

      offset += chunkSize;

      // Stop after IEND
      if (chunkType === 'IEND') {
        break;
      }
    }

    if (removedChunks.length > 0) {
      console.log('Removed metadata chunks:', removedChunks.join(', '));
    }

    // Concatenate all clean chunks
    const totalLength = cleanChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const cleanBytes = new Uint8Array(totalLength);
    let writeOffset = 0;
    for (const chunk of cleanChunks) {
      cleanBytes.set(chunk, writeOffset);
      writeOffset += chunk.length;
    }

    // Encode back to base64
    let binaryStr = '';
    for (let i = 0; i < cleanBytes.length; i++) {
      binaryStr += String.fromCharCode(cleanBytes[i]);
    }
    const cleanBase64 = btoa(binaryStr);

    console.log(`Image cleaned: ${bytes.length} bytes -> ${cleanBytes.length} bytes (removed ${bytes.length - cleanBytes.length} bytes of metadata)`);

    return prefix + cleanBase64;
  } catch (error) {
    console.error('Error stripping metadata:', error);
    return base64Image; // Return original on error
  }
}

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
    console.log('AI Response received, processing...');

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

    // Strip AI metadata from the image
    console.log('Stripping AI metadata from image...');
    const cleanImage = stripPngMetadata(generatedImage);
    console.log('Metadata stripping complete');

    return new Response(
      JSON.stringify({ 
        image: cleanImage,
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
