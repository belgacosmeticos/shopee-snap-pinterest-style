import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Link, Loader2, Plus, X, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SoraVideoData } from '../SoraGenTool';
import { useUsageTracker, COST_ESTIMATES } from '@/hooks/useUsageTracker';

interface SoraUrlInputStepProps {
  onSubmit: (data: SoraVideoData[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  cleanMetadata: boolean;
  setCleanMetadata: (clean: boolean) => void;
}

export const SoraUrlInputStep = ({ onSubmit, isLoading, setIsLoading, cleanMetadata, setCleanMetadata }: SoraUrlInputStepProps) => {
  const [urls, setUrls] = useState<string[]>(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalToExtract, setTotalToExtract] = useState(0);
  const { trackUsage } = useUsageTracker();
  const addUrl = () => {
    if (urls.length < 5) {
      setUrls([...urls, '']);
    }
  };

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const isValidSoraUrl = (url: string) => {
    return url.includes('sora.com') || url.includes('openai.com') || url.includes('chatgpt.com');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting || isLoading) return;
    
    // Filter valid URLs
    const validUrls = urls
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (validUrls.length === 0) {
      toast.error('Por favor, insira pelo menos uma URL do Sora.');
      return;
    }

    // Validate all URLs
    const invalidUrls = validUrls.filter(url => !isValidSoraUrl(url));
    if (invalidUrls.length > 0) {
      toast.error('Algumas URLs não são válidas do Sora. Verifique e tente novamente.');
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);
    setTotalToExtract(validUrls.length);

    const extractedVideos: SoraVideoData[] = [];

    try {
      for (let i = 0; i < validUrls.length; i++) {
        setCurrentIndex(i + 1);
        toast.info(`Extraindo vídeo ${i + 1} de ${validUrls.length}...`);
        
        const { data, error } = await supabase.functions.invoke('extract-sora-video', {
          body: { url: validUrls[i] }
        });

        if (error) {
          console.error(`Error extracting video ${i + 1}:`, error);
          extractedVideos.push({
            videoUrl: null,
            videoUrlNoWatermark: null,
            title: null,
            prompt: null,
            thumbnailUrl: null,
            creator: null,
            originalUrl: validUrls[i],
            hasWatermark: false,
            success: false,
            error: 'Erro ao extrair vídeo'
          });
          continue;
        }

        if (!data.success) {
          extractedVideos.push({
            ...data,
            originalUrl: validUrls[i],
            success: false,
            error: data.error || 'Não foi possível extrair o vídeo'
          });
          continue;
        }

        extractedVideos.push(data);
      }

      const successCount = extractedVideos.filter(v => v.success).length;
      
      // Track usage for each successful extraction
      for (let i = 0; i < successCount; i++) {
        trackUsage({
          tool: 'soragen',
          action: 'video_extraction',
          costType: 'firecrawl',
          estimatedCost: COST_ESTIMATES.soragen_extract,
          success: true,
        });
      }

      if (successCount === validUrls.length) {
        toast.success(`${successCount} vídeo(s) extraído(s) com sucesso!`);
      } else if (successCount > 0) {
        toast.warning(`${successCount} de ${validUrls.length} vídeos extraídos.`);
      } else {
        toast.error('Nenhum vídeo foi extraído com sucesso.');
      }

      onSubmit(extractedVideos);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro inesperado. Tente novamente.');
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  const hasValidUrls = urls.some(url => url.trim().length > 0);

  return (
    <Card className="glass-card animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="w-5 h-5 text-primary" />
          Baixar Vídeos do Sora 2.0
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cole os links de compartilhamento do Sora para baixar os vídeos (até 5)
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {urls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder={`URL do Sora ${index + 1}`}
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                {urls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUrl(index)}
                    disabled={isLoading}
                    className="shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {urls.length < 5 && (
            <Button
              type="button"
              variant="outline"
              onClick={addUrl}
              disabled={isLoading}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar mais URL
            </Button>
          )}

          {/* iPhone Metadata Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-primary" />
              <div>
                <h4 className="font-medium text-sm">Metadados iPhone</h4>
                <p className="text-xs text-muted-foreground">
                  Remove marcas de IA e adiciona metadados de iPhone 16 Pro Max
                </p>
              </div>
            </div>
            <Switch 
              checked={cleanMetadata} 
              onCheckedChange={setCleanMetadata}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit" 
            className="w-full" 
            disabled={isLoading || isSubmitting || !hasValidUrls}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extraindo {currentIndex} de {totalToExtract}...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Extrair Vídeos
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium text-sm mb-2">💡 Dicas</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Vá até sora.chatgpt.com e encontre o vídeo que deseja baixar</li>
            <li>• Clique em "Share" e copie o link</li>
            <li>• Cole o link aqui e clique em "Extrair Vídeos"</li>
            <li>• Você pode baixar até 5 vídeos de uma vez</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
