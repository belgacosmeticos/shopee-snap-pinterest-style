import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Link2, Video, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ExtractedVideo } from '../VideoGenTool';
import { useUsageTracker, COST_ESTIMATES } from '@/hooks/useUsageTracker';

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
  const { trackUsage } = useUsageTracker();
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

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double-submit
    if (isSubmitting || isLoading) return;
    
    setError('');
    setIsSubmitting(true);

    // Link do produto é opcional
    const hasProductUrl = productUrl.trim().length > 0;

    const validVideoUrls = videoUrls.filter(url => url.trim());
    if (validVideoUrls.length === 0) {
      setError('Por favor, insira pelo menos um link de vídeo');
      setIsSubmitting(false);
      return;
    }

    setIsLoading(true);

    try {
      // Extract product data only if URL is provided
      let productTitle = 'Vídeo Shopee';
      let affiliateLink: string | undefined;
      let originalLink: string | undefined;

      if (hasProductUrl) {
        // Check if user accidentally put a video link in the product field
        const isVideoLink = productUrl.includes('shp.ee') && productUrl.includes('smtt');
        
        if (isVideoLink) {
          console.log('[VideoUrlInputStep] Detected video link in product field, skipping product extraction');
          // Don't try to extract product from video link - just continue with video extraction
        } else {
          setExtractingProduct(true);
          console.log('[VideoUrlInputStep] Extracting product data from:', productUrl);
          const { data: productData, error: productError } = await supabase.functions.invoke('extract-shopee', {
            body: { url: productUrl }
          });
          setExtractingProduct(false);

          if (!productError && productData?.success) {
            productTitle = productData.title || 'Produto Shopee';
            affiliateLink = productData.affiliateLink;
            originalLink = productData.originalLink || productUrl;
            console.log('[VideoUrlInputStep] Product data:', productData);
          } else {
            console.log('[VideoUrlInputStep] Product extraction failed, using defaults');
          }
        }
      } else {
        console.log('[VideoUrlInputStep] No product URL, skipping product extraction');
      }

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
              videoUrlNoWatermark: null,
              title: null,
              description: null,
              creator: null,
              thumbnailUrl: null,
              originalUrl: videoUrl,
              hasWatermark: true,
            });
          } else {
            extractedVideos.push({
              videoUrl: videoData?.videoUrl || null,
              videoUrlNoWatermark: videoData?.videoUrlNoWatermark || null,
              title: videoData?.title || null,
              description: videoData?.description || null,
              creator: videoData?.creator || null,
              thumbnailUrl: videoData?.thumbnailUrl || null,
              originalUrl: videoData?.originalUrl || videoUrl,
              hasWatermark: videoData?.hasWatermark ?? true,
            });
          }
        } catch (err) {
          console.error('[VideoUrlInputStep] Error extracting video:', err);
          extractedVideos.push({
            videoUrl: null,
            videoUrlNoWatermark: null,
            title: null,
            description: null,
            creator: null,
            thumbnailUrl: null,
            originalUrl: videoUrl,
            hasWatermark: true,
          });
        }
      }

      setExtractingVideos(false);

      console.log('[VideoUrlInputStep] Extracted videos:', extractedVideos);

      // Track usage for each video extraction
      const successfulExtractions = extractedVideos.filter(v => v.videoUrl !== null).length;
      for (let i = 0; i < successfulExtractions; i++) {
        trackUsage({
          tool: 'videogen',
          action: 'video_extraction',
          costType: 'firecrawl',
          estimatedCost: COST_ESTIMATES.videogen_extract,
          success: true,
        });
      }

      onSubmit({
        title: productTitle,
        affiliateLink: affiliateLink,
        originalLink: originalLink,
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
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 md:p-8 shadow-card gradient-card max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-3">
          <Video className="w-6 h-6 text-coral" />
        </div>
        <h2 className="text-xl font-display font-semibold">Baixar Vídeos Shopee</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cole os links dos vídeos para baixar sem marca d'água
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Video URLs */}
        <div className="space-y-3">
          {videoUrls.map((url, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="url"
                placeholder={`Cole o link do vídeo ${index + 1}...`}
                value={url}
                onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                className="flex-1 h-11"
                disabled={isLoading}
              />
              {videoUrls.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeVideoUrl(index)}
                  disabled={isLoading}
                  className="h-11 w-11"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          {videoUrls.length < 5 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addVideoUrl}
              disabled={isLoading}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4" />
              Adicionar mais vídeo
            </Button>
          )}
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
              {extractingVideos ? 'Extraindo vídeos...' : 'Processando...'}
            </>
          ) : (
            <>
              <Video className="w-5 h-5 mr-2" />
              Extrair Vídeos
            </>
          )}
        </Button>

        {/* Optional: Product link info */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            Quer extrair link de afiliado também?
          </summary>
          <div className="mt-2 space-y-2 pl-4 border-l-2 border-muted">
            <Input
              type="url"
              placeholder="Cole o link do produto Shopee (opcional)"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              className="h-10 text-sm"
              disabled={isLoading}
            />
            <p className="text-xs">
              O link do produto extrai o nome e link de afiliado automaticamente
            </p>
          </div>
        </details>
      </form>
    </Card>
  );
};
