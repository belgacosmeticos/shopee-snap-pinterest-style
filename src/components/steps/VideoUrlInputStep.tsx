import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Video, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ExtractedVideo } from '../VideoGenTool';

interface VideoUrlInputStepProps {
  onSubmit: (data: { 
    title: string; 
    affiliateLink?: string; 
    originalLink?: string;
    videos: ExtractedVideo[];
  }) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const VideoUrlInputStep = ({ onSubmit, isLoading, setIsLoading }: VideoUrlInputStepProps) => {
  const [productUrl, setProductUrl] = useState('');
  const [videoUrls, setVideoUrls] = useState<string[]>(['', '', '']);
  const [error, setError] = useState('');
  const [extractingProduct, setExtractingProduct] = useState(false);
  const [extractingVideos, setExtractingVideos] = useState(false);

  const handleVideoUrlChange = (index: number, value: string) => {
    const newUrls = [...videoUrls];
    newUrls[index] = value;
    setVideoUrls(newUrls);
  };

  const addVideoUrl = () => {
    if (videoUrls.length < 5) {
      setVideoUrls([...videoUrls, '']);
    }
  };

  const removeVideoUrl = (index: number) => {
    if (videoUrls.length > 1) {
      const newUrls = videoUrls.filter((_, i) => i !== index);
      setVideoUrls(newUrls);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!productUrl.trim()) {
      setError('Por favor, insira o link do produto');
      return;
    }

    const validVideoUrls = videoUrls.filter(url => url.trim());
    if (validVideoUrls.length === 0) {
      setError('Por favor, insira pelo menos um link de vídeo');
      return;
    }

    setIsLoading(true);
    setExtractingProduct(true);

    try {
      // Extract product data
      console.log('[VideoUrlInputStep] Extracting product data from:', productUrl);
      const { data: productData, error: productError } = await supabase.functions.invoke('extract-shopee', {
        body: { url: productUrl }
      });

      setExtractingProduct(false);

      if (productError) {
        console.error('[VideoUrlInputStep] Product extraction error:', productError);
        throw new Error('Erro ao extrair dados do produto');
      }

      if (!productData?.success) {
        throw new Error(productData?.error || 'Não foi possível extrair o produto');
      }

      console.log('[VideoUrlInputStep] Product data:', productData);

      // Extract video data
      setExtractingVideos(true);
      const extractedVideos: ExtractedVideo[] = [];

      for (const videoUrl of validVideoUrls) {
        console.log('[VideoUrlInputStep] Extracting video:', videoUrl);
        try {
          const { data: videoData, error: videoError } = await supabase.functions.invoke('extract-shopee-video', {
            body: { url: videoUrl }
          });

          if (videoError) {
            console.error('[VideoUrlInputStep] Video extraction error:', videoError);
            extractedVideos.push({
              videoUrl: null,
              title: null,
              description: null,
              creator: null,
              thumbnailUrl: null,
              originalUrl: videoUrl,
            });
          } else {
            extractedVideos.push({
              videoUrl: videoData?.videoUrl || null,
              title: videoData?.title || null,
              description: videoData?.description || null,
              creator: videoData?.creator || null,
              thumbnailUrl: videoData?.thumbnailUrl || null,
              originalUrl: videoData?.originalUrl || videoUrl,
            });
          }
        } catch (err) {
          console.error('[VideoUrlInputStep] Error extracting video:', err);
          extractedVideos.push({
            videoUrl: null,
            title: null,
            description: null,
            creator: null,
            thumbnailUrl: null,
            originalUrl: videoUrl,
          });
        }
      }

      setExtractingVideos(false);

      console.log('[VideoUrlInputStep] Extracted videos:', extractedVideos);

      onSubmit({
        title: productData.title || 'Produto Shopee',
        affiliateLink: productData.affiliateLink,
        originalLink: productData.originalLink || productUrl,
        videos: extractedVideos,
      });

      toast.success('Dados extraídos com sucesso!');

    } catch (err: any) {
      console.error('[VideoUrlInputStep] Error:', err);
      setError(err.message || 'Erro ao processar os links');
      toast.error(err.message || 'Erro ao processar os links');
    } finally {
      setIsLoading(false);
      setExtractingProduct(false);
      setExtractingVideos(false);
    }
  };

  return (
    <Card className="p-6 md:p-8 shadow-card gradient-card max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product URL */}
        <div className="space-y-2">
          <Label htmlFor="product-url" className="text-base font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4 text-coral" />
            Link do Produto Shopee
          </Label>
          <Input
            id="product-url"
            type="url"
            placeholder="https://shopee.com.br/..."
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            className="h-12 text-base"
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground">
            Cole o link do produto da Shopee para extrair o nome e link de afiliado
          </p>
        </div>

        {/* Video URLs */}
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <Video className="w-4 h-4 text-coral" />
            Links dos Vídeos (Shopee Videos)
          </Label>
          
          {videoUrls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="url"
                placeholder={`https://br.shp.ee/... (Vídeo ${index + 1})`}
                value={url}
                onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                className="flex-1"
                disabled={isLoading}
              />
              {videoUrls.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeVideoUrl(index)}
                  disabled={isLoading}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          {videoUrls.length < 5 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVideoUrl}
              disabled={isLoading}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar mais vídeo
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Cole os links dos vídeos de afiliados da seção "Aprenda com criadores"
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 text-base gradient-primary hover:opacity-90 transition-opacity"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {extractingProduct ? 'Extraindo produto...' : extractingVideos ? 'Extraindo vídeos...' : 'Processando...'}
            </>
          ) : (
            <>
              <Video className="w-5 h-5 mr-2" />
              Extrair Vídeos
            </>
          )}
        </Button>
      </form>
    </Card>
  );
};
