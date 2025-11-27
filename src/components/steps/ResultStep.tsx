import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Copy, RefreshCw, Home, Check, ExternalLink, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import type { GeneratedResult } from '../PinGenTool';

interface ResultStepProps {
  result: GeneratedResult;
  productTitle: string;
  onRegenerate: () => void;
  onReset: () => void;
}

export const ResultStep = ({ result, productTitle, onRegenerate, onReset }: ResultStepProps) => {
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleCopy = async (text: string, type: 'title' | 'desc') => {
    await navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } else {
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 2000);
    }
    toast.success('Copiado!');
  };

  const handleSharePinterest = () => {
    // Pinterest create pin URL
    const pinterestUrl = `https://www.pinterest.com/pin-builder/?description=${encodeURIComponent(result.description)}&media=${encodeURIComponent(result.image)}&method=button`;
    window.open(pinterestUrl, '_blank');
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(result.image);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pinterest-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Imagem baixada!');
    } catch (err) {
      // Fallback: open in new tab
      window.open(result.image, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Generated Image Card */}
      <Card className="p-6 shadow-card gradient-card">
        <h2 className="text-2xl font-display font-semibold mb-4 text-center">
          🎉 Sua imagem está pronta!
        </h2>
        
        <div className="relative aspect-[9/16] max-w-sm mx-auto rounded-2xl overflow-hidden shadow-glow mb-6">
          <img
            src={result.image}
            alt="Generated Pinterest Image"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="pinterest" size="lg" onClick={handleSharePinterest}>
            <ExternalLink className="w-4 h-4" />
            Publicar no Pinterest
          </Button>
          <Button variant="secondary" size="lg" onClick={handleDownload}>
            Baixar Imagem
          </Button>
        </div>
      </Card>

      {/* Title & Caption Card */}
      <Card className="p-6 shadow-card">
        <h3 className="text-lg font-display font-semibold mb-4">Título e Legenda</h3>
        
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Título (para o Pinterest)
            </label>
            <div className="flex gap-2">
              <Input
                value={result.title}
                readOnly
                className="flex-1 bg-secondary/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(result.title, 'title')}
              >
                {copiedTitle ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Legenda (descrição do pin)
            </label>
            <div className="flex gap-2">
              <Textarea
                value={result.description}
                readOnly
                className="flex-1 bg-secondary/50 min-h-[100px]"
              />
              <Button
                variant="outline"
                size="icon"
                className="self-start"
                onClick={() => handleCopy(result.description, 'desc')}
              >
                {copiedDesc ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Regenerate Options */}
      <Card className="p-6 shadow-card">
        <h3 className="text-lg font-display font-semibold mb-4">Não gostou? Gere novamente!</h3>
        
        {!showFeedback ? (
          <div className="flex gap-3">
            <Button variant="soft" onClick={onRegenerate} className="flex-1">
              <RefreshCw className="w-4 h-4" />
              Gerar Novamente
            </Button>
            <Button variant="outline" onClick={() => setShowFeedback(true)} className="flex-1">
              <MessageSquare className="w-4 h-4" />
              Gerar com Observação
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Textarea
              placeholder="Ex: Quero uma foto mais clara, com fundo mais simples..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex gap-3">
              <Button variant="gradient" onClick={onRegenerate} className="flex-1">
                <RefreshCw className="w-4 h-4" />
                Gerar com Feedback
              </Button>
              <Button variant="ghost" onClick={() => setShowFeedback(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Start Over */}
      <div className="text-center">
        <Button variant="ghost" onClick={onReset}>
          <Home className="w-4 h-4" />
          Criar Novo Pin
        </Button>
      </div>
    </div>
  );
};
