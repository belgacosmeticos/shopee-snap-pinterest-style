import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Copy, RefreshCw, Home, Check, Download, ExternalLink, DollarSign, Loader2, Video, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { VideoProductData, ExtractedVideo } from '../VideoGenTool';

// Pinterest & Facebook icons
const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

interface VideoResultStepProps {
  productData: VideoProductData;
  videos: ExtractedVideo[];
  onUpdateVideos: (videos: ExtractedVideo[]) => void;
  onReset: () => void;
}

export const VideoResultStep = ({ 
  productData, 
  videos, 
  onUpdateVideos,
  onReset 
}: VideoResultStepProps) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingCaptions, setGeneratingCaptions] = useState<Record<number, boolean>>({});
  const [copiedCaptions, setCopiedCaptions] = useState<Record<string, boolean>>({});

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCaptions(prev => ({ ...prev, [key]: true }));
    setTimeout(() => setCopiedCaptions(prev => ({ ...prev, [key]: false })), 2000);
    toast.success('Copiado!');
  };

  const handleCopyAffiliateLink = async () => {
    if (productData.affiliateLink) {
      await navigator.clipboard.writeText(productData.affiliateLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success('Link de afiliado copiado!');
    }
  };

  const handleGenerateCaption = async (index: number, platform: 'pinterest' | 'facebook') => {
    setGeneratingCaptions(prev => ({ ...prev, [index]: true }));

    try {
      const video = videos[index];
      const { data, error } = await supabase.functions.invoke('generate-video-caption', {
        body: {
          productTitle: productData.title,
          videoTitle: video.title,
          platform,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const updatedVideos = [...videos];
      if (platform === 'pinterest') {
        updatedVideos[index] = { ...updatedVideos[index], caption: data.caption };
      } else {
        updatedVideos[index] = { ...updatedVideos[index], captionFacebook: data.caption };
      }
      onUpdateVideos(updatedVideos);

      toast.success(`Legenda para ${platform === 'pinterest' ? 'Pinterest' : 'Facebook'} gerada!`);
    } catch (err: any) {
      console.error('[VideoResultStep] Error generating caption:', err);
      toast.error(err.message || 'Erro ao gerar legenda');
    } finally {
      setGeneratingCaptions(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleDownloadVideo = async (videoUrl: string | null, originalUrl: string) => {
    if (videoUrl) {
      try {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Vídeo baixado!');
      } catch {
        window.open(videoUrl, '_blank');
        toast.info('Abrindo vídeo em nova aba');
      }
    } else {
      window.open(originalUrl, '_blank');
      toast.info('Abrindo link original - baixe manualmente');
    }
  };

  const handleSharePinterest = (caption: string) => {
    const url = `https://www.pinterest.com/pin-builder/?description=${encodeURIComponent(caption)}`;
    window.open(url, '_blank');
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/`;
    window.open(url, '_blank');
    toast.info('Cole a legenda e faça upload do vídeo no Facebook');
  };

  return (
    <div className="space-y-6">
      {/* Product Title */}
      <Card className="p-4 md:p-6 shadow-card gradient-card">
        <h2 className="text-xl md:text-2xl font-display font-semibold mb-2">
          📦 {productData.title}
        </h2>
        <p className="text-muted-foreground text-sm">
          {videos.length} vídeo(s) extraído(s)
        </p>
      </Card>

      {/* Affiliate Link Card */}
      {productData.affiliateLink && (
        <Card className="p-4 md:p-6 shadow-card border-2 border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="text-lg font-display font-semibold text-green-700 dark:text-green-400">
              Link de Afiliado Convertido
            </h3>
          </div>
          
          <div className="flex gap-2">
            <Input
              value={productData.affiliateLink}
              readOnly
              className="flex-1 bg-background text-sm font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(productData.affiliateLink, '_blank')}
              title="Abrir link"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCopyAffiliateLink}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Use este link nas legendas para ganhar comissão! 💰
          </p>
        </Card>
      )}

      {/* Videos List */}
      <div className="space-y-4">
        <h3 className="text-lg font-display font-semibold flex items-center gap-2">
          <Video className="w-5 h-5 text-coral" />
          Vídeos Extraídos
        </h3>

        {videos.map((video, index) => (
          <Card key={index} className="p-4 md:p-6 shadow-card">
            <div className="space-y-4">
              {/* Video Info */}
              <div className="flex gap-4">
                {/* Thumbnail */}
                <div className="w-24 h-32 md:w-32 md:h-40 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {video.thumbnailUrl ? (
                    <img 
                      src={video.thumbnailUrl} 
                      alt={`Video ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm md:text-base mb-1 line-clamp-2">
                    {video.title || `Vídeo ${index + 1}`}
                  </h4>
                  {video.creator && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Por: @{video.creator}
                    </p>
                  )}
                  
                  {/* Download Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadVideo(video.videoUrl, video.originalUrl)}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    {video.videoUrl ? 'Baixar Vídeo' : 'Abrir Link'}
                  </Button>
                </div>
              </div>

              {/* Caption Generation */}
              <div className="space-y-3 pt-3 border-t">
                {/* Pinterest Caption */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <PinterestIcon />
                      Legenda Pinterest
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateCaption(index, 'pinterest')}
                      disabled={generatingCaptions[index]}
                      className="gap-2"
                    >
                      {generatingCaptions[index] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Gerar
                    </Button>
                  </div>
                  {video.caption && (
                    <div className="space-y-2">
                      <Textarea
                        value={video.caption}
                        readOnly
                        className="min-h-[80px] text-sm bg-secondary/50"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(video.caption!, `pinterest-${index}`)}
                          className="gap-2"
                        >
                          {copiedCaptions[`pinterest-${index}`] ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          Copiar
                        </Button>
                        <Button
                          variant="pinterest"
                          size="sm"
                          onClick={() => handleSharePinterest(video.caption!)}
                          className="gap-2"
                        >
                          <PinterestIcon />
                          Postar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Facebook Caption */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FacebookIcon />
                      Legenda Facebook
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateCaption(index, 'facebook')}
                      disabled={generatingCaptions[index]}
                      className="gap-2"
                    >
                      {generatingCaptions[index] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Gerar
                    </Button>
                  </div>
                  {video.captionFacebook && (
                    <div className="space-y-2">
                      <Textarea
                        value={video.captionFacebook}
                        readOnly
                        className="min-h-[80px] text-sm bg-secondary/50"
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(video.captionFacebook!, `facebook-${index}`)}
                          className="gap-2"
                        >
                          {copiedCaptions[`facebook-${index}`] ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          Copiar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleShareFacebook}
                          className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white border-0"
                        >
                          <FacebookIcon />
                          Postar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Reset Button */}
      <div className="flex justify-center pt-4">
        <Button
          variant="outline"
          size="lg"
          onClick={onReset}
          className="gap-2"
        >
          <Home className="w-5 h-5" />
          Criar Novo
        </Button>
      </div>
    </div>
  );
};
