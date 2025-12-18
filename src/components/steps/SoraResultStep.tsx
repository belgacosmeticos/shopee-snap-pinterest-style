import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Download, 
  Copy, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Link,
  AlertTriangle,
  ExternalLink,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

import { SoraVideoData } from '../SoraGenTool';

// Decode HTML entities in video URLs
function decodeVideoUrl(url: string): string {
  return url
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

interface SoraResultStepProps {
  videos: SoraVideoData[];
  onReset: () => void;
}

export const SoraResultStep = ({ videos, onReset }: SoraResultStepProps) => {
  const [copiedPrompts, setCopiedPrompts] = useState<Record<number, boolean>>({});
  const [copiedLinks, setCopiedLinks] = useState<Record<number, boolean>>({});

  const handleCopyPrompt = async (index: number, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompts(prev => ({ ...prev, [index]: true }));
      toast.success('Prompt copiado!');
      setTimeout(() => setCopiedPrompts(prev => ({ ...prev, [index]: false })), 2000);
    } catch (error) {
      toast.error('Erro ao copiar prompt.');
    }
  };

  const handleCopyLink = async (index: number, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinks(prev => ({ ...prev, [index]: true }));
      toast.success('Link copiado!');
      setTimeout(() => setCopiedLinks(prev => ({ ...prev, [index]: false })), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link.');
    }
  };

  const handleDownload = async (video: SoraVideoData) => {
    const rawVideoUrl = video.videoUrlNoWatermark || video.videoUrl;
    
    if (!rawVideoUrl) {
      toast.error('URL do vídeo não disponível.');
      return;
    }

    const videoUrl = decodeVideoUrl(rawVideoUrl);

    try {
      toast.info('Iniciando download...');
      
      // Use fetch directly to handle binary data properly (SDK corrupts binary responses)
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-sora-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'download', videoUrl }),
        }
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get blob directly from response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sora-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download concluído!');
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(videoUrl, '_blank');
      toast.info('Abrindo vídeo em nova aba para download manual.');
    }
  };

  const successfulVideos = videos.filter(v => v.success);
  const failedVideos = videos.filter(v => !v.success);

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Summary */}
      {videos.length > 1 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {successfulVideos.length} de {videos.length} vídeos extraídos
          </span>
        </div>
      )}

      {/* Successful Videos */}
      {successfulVideos.map((video, originalIndex) => {
        const index = videos.indexOf(video);
        const videoLink = video.videoUrlNoWatermark || video.videoUrl;
        
        return (
          <Card key={index} className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="w-5 h-5 text-primary" />
                {videos.length > 1 ? `Vídeo ${index + 1}` : 'Vídeo Extraído'}
                {video.hasWatermark && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-500">
                    <AlertTriangle className="w-3 h-3" />
                    Com watermark
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video Player */}
              {(video.videoUrlNoWatermark || video.videoUrl) && (
                <div className="aspect-video rounded-lg overflow-hidden bg-black">
                  <video
                    src={video.videoUrlNoWatermark || video.videoUrl || ''}
                    controls
                    className="w-full h-full object-contain"
                    poster={video.thumbnailUrl || undefined}
                  />
                </div>
              )}

              {/* Title */}
              {video.title && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-1">Título</h3>
                  <p className="text-foreground">{video.title}</p>
                </div>
              )}

              {/* Creator */}
              {video.creator && (
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground mb-1">Criador</h3>
                  <p className="text-foreground">@{video.creator}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleDownload(video)} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Vídeo
                </Button>
                {videoLink && (
                  <Button variant="outline" onClick={() => handleCopyLink(index, videoLink)}>
                    {copiedLinks[index] ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Link className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => window.open(video.originalUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              {/* Prompt */}
              {video.prompt && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Prompt do Vídeo
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleCopyPrompt(index, video.prompt!)}
                    >
                      {copiedPrompts[index] ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <Textarea
                    value={video.prompt}
                    readOnly
                    className="min-h-[80px] resize-none"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Failed Videos */}
      {failedVideos.length > 0 && (
        <Card className="glass-card border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <XCircle className="w-5 h-5" />
              Falha na Extração ({failedVideos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {failedVideos.map((video, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span className="break-all">{video.originalUrl}</span>
                  {video.error && (
                    <span className="text-destructive">- {video.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Reset Button */}
      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="w-4 h-4 mr-2" />
        Extrair Outros Vídeos
      </Button>
    </div>
  );
};
