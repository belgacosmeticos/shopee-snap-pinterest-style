import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Copy, RefreshCw, Home, Check, Download, ExternalLink, DollarSign, Loader2, Video, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { VideoProductData, ExtractedVideo } from '../VideoGenTool';

// Pinterest & Facebook icons
const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
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
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [rewritingTitle, setRewritingTitle] = useState(false);
  const [displayTitle, setDisplayTitle] = useState(productData.title);
  const [rewritingCaptions, setRewritingCaptions] = useState<Record<number, boolean>>({});
  const [copiedCaptions, setCopiedCaptions] = useState<Record<number, boolean>>({});
  const [videoCaptions, setVideoCaptions] = useState<Record<number, string>>(() => {
    // Initialize with original video description/title as captions
    const initial: Record<number, string> = {};
    videos.forEach((video, index) => {
      // Prefer description (full caption), then title, then fallback
      const caption = video.description || video.title || `${productData.title} ✨ Link na bio! #shopee #afiliado`;
      initial[index] = caption;
    });
    return initial;
  });

  const handleCopyTitle = async () => {
    await navigator.clipboard.writeText(displayTitle);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 2000);
    toast.success('Título copiado!');
  };

  const handleCopyAffiliateLink = async () => {
    if (productData.affiliateLink) {
      await navigator.clipboard.writeText(productData.affiliateLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success('Link de afiliado copiado!');
    }
  };

  const handleCopyCaption = async (index: number) => {
    await navigator.clipboard.writeText(videoCaptions[index]);
    setCopiedCaptions(prev => ({ ...prev, [index]: true }));
    setTimeout(() => setCopiedCaptions(prev => ({ ...prev, [index]: false })), 2000);
    toast.success('Legenda copiada!');
  };

  const handleRewriteTitle = async () => {
    setRewritingTitle(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-caption', {
        body: {
          productTitle: productData.title,
          rewriteTitle: true,
          originalTitle: displayTitle,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setDisplayTitle(data.rewrittenTitle || displayTitle);
      toast.success('Título reescrito!');
    } catch (err: any) {
      console.error('[VideoResultStep] Error rewriting title:', err);
      toast.error(err.message || 'Erro ao reescrever título');
    } finally {
      setRewritingTitle(false);
    }
  };

  const handleRewriteCaption = async (index: number) => {
    setRewritingCaptions(prev => ({ ...prev, [index]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('generate-video-caption', {
        body: {
          productTitle: productData.title,
          rewriteCaption: true,
          originalCaption: videoCaptions[index],
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setVideoCaptions(prev => ({
        ...prev,
        [index]: data.rewrittenCaption || prev[index]
      }));
      toast.success('Legenda reescrita!');
    } catch (err: any) {
      console.error('[VideoResultStep] Error rewriting caption:', err);
      toast.error(err.message || 'Erro ao reescrever legenda');
    } finally {
      setRewritingCaptions(prev => ({ ...prev, [index]: false }));
    }
  };

  const [downloadingVideo, setDownloadingVideo] = useState<Record<number, boolean>>({});

  const handleDownloadVideo = async (video: ExtractedVideo, index: number) => {
    setDownloadingVideo(prev => ({ ...prev, [index]: true }));
    
    // Prioritize watermark-free URL
    const downloadUrl = video.videoUrlNoWatermark || video.videoUrl;
    const isWatermarkFree = !!video.videoUrlNoWatermark;
    
    if (downloadUrl) {
      try {
        toast.info(isWatermarkFree ? 'Baixando vídeo sem marca d\'água...' : 'Baixando vídeo...');
        const response = await fetch(downloadUrl, { mode: 'cors' });
        
        if (!response.ok) {
          throw new Error('Falha ao baixar');
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video-shopee-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(isWatermarkFree ? 'Vídeo baixado sem marca d\'água!' : 'Vídeo baixado!');
      } catch (err) {
        console.error('[VideoResultStep] Download error:', err);
        // Fallback: open in new tab
        window.open(downloadUrl, '_blank');
        toast.info('Abrindo vídeo em nova aba - clique com botão direito e "Salvar como"');
      }
    } else {
      // No direct video URL - open original and show instructions
      window.open(video.originalUrl, '_blank');
      toast.info('Abra o app Shopee, toque em "Abrir Link" e baixe pelo app', {
        duration: 5000,
      });
    }
    
    setDownloadingVideo(prev => ({ ...prev, [index]: false }));
  };

  const handleCopyVideoLink = async (videoUrl: string | null, originalUrl: string) => {
    const urlToCopy = videoUrl || originalUrl;
    await navigator.clipboard.writeText(urlToCopy);
    toast.success('Link do vídeo copiado!');
  };

  const handleSharePinterest = () => {
    const url = `https://www.pinterest.com/pin-builder/`;
    window.open(url, '_blank');
    toast.info('Faça upload do vídeo e cole a legenda');
  };

  const handleShareInstagramReels = () => {
    const url = `https://www.instagram.com/reels/`;
    window.open(url, '_blank');
    toast.info('Abra o Instagram, crie um Reel e faça upload do vídeo');
  };

  const handleShareFacebookReels = () => {
    // Facebook Reels Creator Studio
    const url = `https://www.facebook.com/reels/create`;
    window.open(url, '_blank');
    toast.info('Faça upload do vídeo no Facebook Reels');
  };

  const handleNativeShare = async (video: ExtractedVideo, caption: string) => {
    const videoUrl = video.videoUrlNoWatermark || video.videoUrl;
    
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        // Try to share with video file if possible
        if (videoUrl) {
          try {
            const response = await fetch(videoUrl, { mode: 'cors' });
            if (response.ok) {
              const blob = await response.blob();
              const file = new File([blob], `video-shopee-${Date.now()}.mp4`, { type: 'video/mp4' });
              
              // Check if can share files
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  files: [file],
                  title: 'Vídeo Shopee',
                  text: caption,
                });
                toast.success('Compartilhado com sucesso!');
                return;
              }
            }
          } catch (fetchError) {
            console.log('[VideoResultStep] Could not fetch video for sharing, falling back to text share');
          }
        }
        
        // Fallback: share just text/URL
        await navigator.share({
          title: 'Vídeo Shopee',
          text: caption,
          url: videoUrl || video.originalUrl,
        });
        toast.success('Compartilhado!');
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('[VideoResultStep] Share error:', error);
          toast.error('Erro ao compartilhar');
        }
      }
    } else {
      // Fallback for browsers without Web Share API
      await navigator.clipboard.writeText(caption);
      toast.success('Legenda copiada! Cole no app desejado');
    }
  };

  return (
    <div className="space-y-6">
      {/* Product Title Card */}
      <Card className="p-4 md:p-6 shadow-card gradient-card">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Título do Produto</h3>
        </div>
        <div className="flex gap-2">
          <Input
            value={displayTitle}
            readOnly
            className="flex-1 bg-secondary/50 font-medium"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleRewriteTitle}
            disabled={rewritingTitle}
            title="Reescrever com IA"
          >
            <RefreshCw className={`w-4 h-4 ${rewritingTitle ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyTitle}
          >
            {copiedTitle ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {videos.length} vídeo(s) extraído(s) • Clique em ♻️ para variar o texto com IA
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
              Link de Afiliado
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
            Coloque este link na bio ou descrição para ganhar comissão! 💰
          </p>
        </Card>
      )}

      {/* Videos List */}
      <div className="space-y-4">
        <h3 className="text-lg font-display font-semibold flex items-center gap-2">
          <Video className="w-5 h-5 text-coral" />
          Vídeos
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

                {/* Info & Download */}
                <div className="flex-1 min-w-0 space-y-3">
                  <h4 className="font-semibold text-sm md:text-base line-clamp-2">
                    Vídeo {index + 1}
                  </h4>
                  {video.creator && (
                    <p className="text-xs text-muted-foreground">
                      Por: @{video.creator}
                    </p>
                  )}
                  
                  {/* Download Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleDownloadVideo(video, index)}
                      disabled={downloadingVideo[index]}
                      className="gap-2 gradient-primary"
                    >
                      {downloadingVideo[index] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {video.videoUrlNoWatermark ? 'Baixar HD' : video.videoUrl ? 'Baixar MP4' : 'Abrir no App'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyVideoLink(video.videoUrlNoWatermark || video.videoUrl, video.originalUrl)}
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copiar Link
                    </Button>
                  </div>
                  
                  {/* Watermark status indicator */}
                  {video.videoUrlNoWatermark && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Sem marca d'água
                    </p>
                  )}
                  {!video.videoUrlNoWatermark && video.videoUrl && (
                    <p className="text-xs text-muted-foreground">
                      Com marca d'água da Shopee
                    </p>
                  )}
                </div>
              </div>

              {/* Caption Section */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Legenda</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRewriteCaption(index)}
                    disabled={rewritingCaptions[index]}
                    className="gap-2"
                    title="Reescrever com IA (mantém 99% da ideia)"
                  >
                    {rewritingCaptions[index] ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Variar
                  </Button>
                </div>
                
                <Textarea
                  value={videoCaptions[index]}
                  onChange={(e) => setVideoCaptions(prev => ({ ...prev, [index]: e.target.value }))}
                  className="min-h-[100px] text-sm"
                  placeholder="Legenda do vídeo..."
                />

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyCaption(index)}
                    className="gap-2"
                  >
                    {copiedCaptions[index] ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copiar
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleNativeShare(video, videoCaptions[index])}
                    className="gap-2 gradient-primary"
                  >
                    <Share2 className="w-4 h-4" />
                    Compartilhar
                  </Button>
                  
                  <Button
                    variant="pinterest"
                    size="sm"
                    onClick={handleSharePinterest}
                    className="gap-2"
                  >
                    <PinterestIcon />
                    Pin
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={handleShareFacebookReels}
                    className="gap-2 bg-[#1877F2] hover:bg-[#1877F2]/90 text-white"
                  >
                    <FacebookIcon />
                    FB Reel
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={handleShareInstagramReels}
                    className="gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] hover:opacity-90 text-white"
                  >
                    <InstagramIcon />
                    IG Reel
                  </Button>
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
