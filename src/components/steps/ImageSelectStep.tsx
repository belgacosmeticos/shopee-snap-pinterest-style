import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Check, Image as ImageIcon } from 'lucide-react';

interface ImageSelectStepProps {
  images: string[];
  title: string;
  onSelect: (imageUrl: string) => void;
  onBack: () => void;
}

export const ImageSelectStep = ({ images, title, onSelect, onBack }: ImageSelectStepProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleContinue = () => {
    if (selectedIndex !== null) {
      onSelect(images[selectedIndex]);
    }
  };

  return (
    <Card className="p-8 shadow-card gradient-card">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-display font-semibold">Escolha a imagem</h2>
          <p className="text-muted-foreground text-sm line-clamp-1">{title}</p>
        </div>
      </div>

      <p className="text-muted-foreground mb-6">
        Selecione a imagem que será usada como referência para gerar a foto do Pinterest
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {images.map((img, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(index)}
            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 hover:scale-[1.02] ${
              selectedIndex === index
                ? 'border-coral shadow-glow ring-2 ring-coral/30'
                : 'border-border hover:border-coral/50'
            }`}
          >
            <img
              src={img}
              alt={`Opção ${index + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder.svg';
              }}
            />
            {selectedIndex === index && (
              <div className="absolute inset-0 bg-coral/20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-coral flex items-center justify-center">
                  <Check className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {images.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma imagem encontrada</p>
        </div>
      )}

      <Button
        variant="gradient"
        size="xl"
        className="w-full"
        disabled={selectedIndex === null}
        onClick={handleContinue}
      >
        Continuar com esta imagem
      </Button>
    </Card>
  );
};
