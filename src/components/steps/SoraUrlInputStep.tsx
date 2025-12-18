import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Link, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SoraVideoData } from '../SoraGenTool';

interface SoraUrlInputStepProps {
  onSubmit: (data: SoraVideoData) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const SoraUrlInputStep = ({ onSubmit, isLoading, setIsLoading }: SoraUrlInputStepProps) => {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting || isLoading) return;
    
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
      toast.error('Por favor, insira uma URL do Sora.');
      return;
    }

    // Validate Sora URL
    if (!trimmedUrl.includes('sora.com') && !trimmedUrl.includes('openai.com') && !trimmedUrl.includes('chatgpt.com')) {
      toast.error('Por favor, insira uma URL válida do Sora.');
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      toast.info('Extraindo vídeo do Sora...');
      
      const { data, error } = await supabase.functions.invoke('extract-sora-video', {
        body: { url: trimmedUrl }
      });

      if (error) {
        console.error('Error extracting Sora video:', error);
        toast.error('Erro ao extrair vídeo. Tente novamente.');
        setIsSubmitting(false);
        setIsLoading(false);
        return;
      }

      if (!data.success) {
        toast.error(data.error || 'Não foi possível extrair o vídeo.');
        setIsSubmitting(false);
        setIsLoading(false);
        return;
      }

      toast.success('Vídeo extraído com sucesso!');
      onSubmit(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro inesperado. Tente novamente.');
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass-card animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="w-5 h-5 text-primary" />
          Baixar Vídeo do Sora 2.0
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cole o link de compartilhamento do Sora para baixar o vídeo
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://sora.chatgpt.com/p/s_..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="pl-10"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Exemplo: https://sora.chatgpt.com/p/s_694309bcaa208191b60bfd2bee7f21c1
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || isSubmitting || !url.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Extraindo...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Extrair Vídeo
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 p-4 rounded-lg bg-muted/50">
          <h4 className="font-medium text-sm mb-2">💡 Dicas</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Vá até sora.chatgpt.com e encontre o vídeo que deseja baixar</li>
            <li>• Clique em "Share" e copie o link</li>
            <li>• Cole o link aqui e clique em "Extrair Vídeo"</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
