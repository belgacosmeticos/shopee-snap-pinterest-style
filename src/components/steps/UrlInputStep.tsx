import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Link, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PinterestModeToggle, PublishMode } from '../PinterestModeToggle';
import { usePinterestAuth } from '@/hooks/usePinterestAuth';

interface UrlInputStepProps {
  onSubmit: (data: { title: string; images: string[]; affiliateLink?: string; originalLink?: string }, publishMode: PublishMode) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const UrlInputStep = ({ onSubmit, isLoading, setIsLoading }: UrlInputStepProps) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [publishMode, setPublishMode] = useState<PublishMode>('manual');
  
  const pinterest = usePinterestAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Por favor, insira um link do produto');
      return;
    }

    // If Pinterest mode selected but not connected, show error
    if (publishMode === 'pinterest' && !pinterest.isConnected) {
      setError('Conecte sua conta do Pinterest primeiro');
      return;
    }

    setIsLoading(true);

    try {
      console.log('[UrlInputStep] Iniciando extração para:', url.trim());
      
      const response = await supabase.functions.invoke('extract-shopee', {
        body: { url: url.trim() }
      });

      console.log('[UrlInputStep] Resposta da função:', response);

      if (response.error) {
        console.error('[UrlInputStep] Erro da função:', response.error);
        setError('Erro ao conectar com o servidor. Tente novamente.');
        return;
      }

      const data = response.data;

      if (!data) {
        console.error('[UrlInputStep] Resposta vazia da função');
        setError('Resposta inválida do servidor. Tente novamente.');
        return;
      }

      if (data.error) {
        console.error('[UrlInputStep] Erro na extração:', data.error);
        setError(data.error);
        return;
      }

      if (!data.images || !Array.isArray(data.images) || data.images.length === 0) {
        console.error('[UrlInputStep] Nenhuma imagem encontrada:', data);
        setError('Não foi possível encontrar imagens neste produto. Tente outro link.');
        return;
      }

      console.log('[UrlInputStep] Sucesso! Imagens encontradas:', data.images.length);
      toast.success(`${data.images.length} imagens encontradas!`);
      
      onSubmit({ 
        title: data.title || 'Produto', 
        images: data.images,
        affiliateLink: data.affiliateLink,
        originalLink: data.originalLink
      }, publishMode);
    } catch (err) {
      console.error('[UrlInputStep] Erro inesperado:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[UrlInputStep] Mensagem:', errorMessage);
      setError('Erro ao processar o link. Verifique se é um link válido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-8 shadow-card gradient-card">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
          <Link className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-display font-semibold mb-2">Cole o link do produto</h2>
        <p className="text-muted-foreground">
          Insira o link de qualquer produto para extrair as imagens
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            type="url"
            placeholder="https://exemplo.com/produto..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            className="h-14 pl-4 pr-4 text-base rounded-xl border-2 border-border focus:border-coral transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Pinterest Mode Toggle */}
        <PinterestModeToggle
          mode={publishMode}
          onModeChange={setPublishMode}
          isConnected={pinterest.isConnected}
          isLoading={pinterest.isLoading}
          onConnect={pinterest.connect}
          onDisconnect={pinterest.disconnect}
        />

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="gradient"
          size="xl"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Extraindo imagens...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Extrair Imagens
            </>
          )}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground text-center">
          💡 Dica: Use o link completo do produto para melhores resultados
        </p>
      </div>
    </Card>
  );
};
