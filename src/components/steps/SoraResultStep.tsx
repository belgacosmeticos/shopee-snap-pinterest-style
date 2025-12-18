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
  ExternalLink
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
  videoData: SoraVideoData;
  onReset: () => void;
}

export const SoraResultStep = ({ videoData, onReset }: SoraResultStepProps) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyPrompt = async () => {
    if (!videoData.prompt) return;
    
    try {
      await navigator.clipboard.writeText(videoData.prompt);
      setCopiedPrompt(true);
      toast.success('Prompt copiado!');
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar prompt.');
    }
  };

  const handleCopyLink = async () => {
    const link = videoData.videoUrlNoWatermark || videoData.videoUrl;
    if (!link) return;
    
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      toast.error('Erro ao copiar link.');
    }
  };

  const handleDownload = async () => {
    const rawVideoUrl = videoData.videoUrlNoWatermark || videoData.videoUrl;
    
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

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Video Preview Card */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            Vídeo Extraído
            {videoData.hasWatermark && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-amber-500">
                <AlertTriangle className="w-3 h-3" />
                Com watermark
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Player */}
          {(videoData.videoUrlNoWatermark || videoData.videoUrl) && (
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <video
                src={videoData.videoUrlNoWatermark || videoData.videoUrl || ''}
                controls
                className="w-full h-full object-contain"
                poster={videoData.thumbnailUrl || undefined}
              />
            </div>
          )}

          {/* Title */}
          {videoData.title && (
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-1">Título</h3>
              <p className="text-foreground">{videoData.title}</p>
            </div>
          )}

          {/* Creator */}
          {videoData.creator && (
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-1">Criador</h3>
              <p className="text-foreground">@{videoData.creator}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Baixar Vídeo
            </Button>
            <Button variant="outline" onClick={handleCopyLink}>
              {copiedLink ? (
                <Check className="w-4 h-4" />
              ) : (
                <Link className="w-4 h-4" />
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => window.open(videoData.originalUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Card */}
      {videoData.prompt && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-lg">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Prompt do Vídeo
              </span>
              <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
                {copiedPrompt ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={videoData.prompt}
              readOnly
              className="min-h-[100px] resize-none"
            />
          </CardContent>
        </Card>
      )}

      {/* Reset Button */}
      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="w-4 h-4 mr-2" />
        Extrair Outro Vídeo
      </Button>
    </div>
  );
};
