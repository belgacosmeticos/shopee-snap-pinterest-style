import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Sparkles, Shuffle, Camera, Sun, Building, Leaf, ShoppingBag, Waves, Home, TreeDeciduous } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProductData, GeneratedResult } from '../PinGenTool';

interface GenerateStepProps {
  productData: ProductData;
  onGenerate: (result: GeneratedResult) => void;
  onBack: () => void;
}

const SCENES = [
  { icon: Camera, label: 'Estúdio Minimalista', description: 'Fundo clean e iluminação profissional' },
  { icon: Building, label: 'Street Style Paris', description: 'Urbano elegante com cafés' },
  { icon: Home, label: 'Flat Lay Cozy', description: 'Decoração aconchegante de quarto' },
  { icon: Leaf, label: 'Jardim Natural', description: 'Ao ar livre com natureza' },
  { icon: ShoppingBag, label: 'Luxo Marble', description: 'Fundo mármore sofisticado' },
  { icon: Waves, label: 'Sunset Beach', description: 'Praia ao pôr do sol' },
  { icon: Sun, label: 'Golden Hour', description: 'Luz dourada do entardecer' },
  { icon: TreeDeciduous, label: 'Outono Fashion', description: 'Parque com folhas de outono' },
];

export const GenerateStep = ({ productData, onGenerate, onBack }: GenerateStepProps) => {
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      // Generate the image
      const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-pinterest-image', {
        body: {
          imageUrl: productData.selectedImage,
          productTitle: productData.title,
          customPrompt: customPrompt || undefined,
          sceneIndex: selectedScene ?? undefined,
        }
      });

      if (imageError) throw imageError;
      if (imageData.error) throw new Error(imageData.error);

      // Generate the caption
      const { data: captionData, error: captionError } = await supabase.functions.invoke('generate-pinterest-caption', {
        body: {
          productTitle: productData.title,
          sceneDescription: imageData.sceneUsed,
        }
      });

      if (captionError) throw captionError;

      toast.success('Imagem gerada com sucesso!');
      
      onGenerate({
        image: imageData.image,
        title: captionData?.title || `✨ ${productData.title.slice(0, 80)}`,
        description: captionData?.description || `Look inspirador! #moda #fashion #style`,
        sceneUsed: imageData.sceneUsed,
      });
    } catch (err: any) {
      console.error('Error:', err);
      toast.error(err.message || 'Erro ao gerar imagem. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRandomScene = () => {
    const randomIndex = Math.floor(Math.random() * SCENES.length);
    setSelectedScene(randomIndex);
    toast.info(`Cenário "${SCENES[randomIndex].label}" selecionado!`);
  };

  return (
    <Card className="p-8 shadow-card gradient-card">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-display font-semibold">Personalize a geração</h2>
          <p className="text-muted-foreground text-sm">Escolha o cenário ou deixe aleatório</p>
        </div>
      </div>

      {/* Preview da imagem selecionada */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Imagem de referência:</p>
        <div className="w-32 h-32 rounded-xl overflow-hidden border-2 border-coral shadow-soft">
          <img
            src={productData.selectedImage}
            alt="Referência"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Scene Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Cenário da foto:</p>
          <Button variant="soft" size="sm" onClick={handleRandomScene}>
            <Shuffle className="w-4 h-4" />
            Aleatório
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCENES.map((scene, index) => {
            const Icon = scene.icon;
            return (
              <button
                key={index}
                onClick={() => setSelectedScene(index)}
                className={`p-3 rounded-xl border-2 transition-all text-left hover:scale-[1.02] ${
                  selectedScene === index
                    ? 'border-coral bg-coral/10'
                    : 'border-border hover:border-coral/50'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${selectedScene === index ? 'text-coral' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium line-clamp-1">{scene.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{scene.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Prompt */}
      <div className="mb-6">
        <p className="text-sm font-medium mb-2">Ou descreva o cenário desejado (opcional):</p>
        <Textarea
          placeholder="Ex: Foto em um café parisiense com luz natural entrando pela janela..."
          value={customPrompt}
          onChange={(e) => {
            setCustomPrompt(e.target.value);
            if (e.target.value) setSelectedScene(null);
          }}
          className="min-h-[80px] rounded-xl"
        />
      </div>

      <Button
        variant="gradient"
        size="xl"
        className="w-full"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Gerando imagem viral...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Gerar Imagem para Pinterest
          </>
        )}
      </Button>

      {isGenerating && (
        <p className="text-center text-sm text-muted-foreground mt-4 animate-pulse">
          ✨ Criando sua foto estilo Pinterest... Isso pode levar alguns segundos.
        </p>
      )}
    </Card>
  );
};
