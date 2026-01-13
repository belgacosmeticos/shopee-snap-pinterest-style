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
  XCircle,
  Loader2,
  Smartphone,
  DownloadCloud
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
  cleanMetadata: boolean;
}

export const SoraResultStep = ({ videos, onReset, cleanMetadata }: SoraResultStepProps) => {
  const [copiedPrompts, setCopiedPrompts] = useState<Record<number, boolean>>({});
  const [copiedLinks, setCopiedLinks] = useState<Record<number, boolean>>({});
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [processingMetadata, setProcessingMetadata] = useState(false);
  
  // Batch download state
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

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

  const handleDownload = async (video: SoraVideoData, index: number, silent = false): Promise<boolean> => {
    const rawVideoUrl = video.videoUrlNoWatermark || video.videoUrl;
    
    if (!rawVideoUrl) {
      if (!silent) toast.error('URL do vídeo não disponível.');
      return false;
    }

    const videoUrl = decodeVideoUrl(rawVideoUrl);
    setDownloadingIndex(index);

    try {
      if (!silent) toast.info('Baixando vídeo...');
      
      // Use fetch directly to handle binary data properly
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

      const contentType = response.headers.get('content-type') || '';
      
      // Check if server returned JSON (fallback case)
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.directUrl) {
          if (!silent) toast.info('Tentando download direto...');
          window.open(json.directUrl, '_blank');
          setDownloadingIndex(null);
          return true;
        }
        throw new Error(json.error || 'Download failed');
      }

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Get blob directly from response
      let blob = await response.blob();
      
      // Check if we got a valid video blob
      if (blob.size < 1000) {
        throw new Error('Invalid video response');
      }

      // Process metadata if enabled
      if (cleanMetadata) {
        setProcessingMetadata(true);
        if (!silent) toast.info('Limpando metadados de IA...');
        
        try {
          // Convert blob to base64 for processing
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          
          // Convert to base64 in chunks
          const chunkSize = 32768;
          let binaryString = '';
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binaryString += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64Video = btoa(binaryString);
          
          // Send to process-video-metadata edge function
          const processResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-video-metadata`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ videoBase64: base64Video }),
            }
          );

          if (processResponse.ok) {
            const processData = await processResponse.json();
            
            if (processData.success && processData.videoBase64) {
              // Validate base64 before using
              try {
                const decodedBinary = atob(processData.videoBase64);
                const processedBytes = new Uint8Array(decodedBinary.length);
                for (let i = 0; i < decodedBinary.length; i++) {
                  processedBytes[i] = decodedBinary.charCodeAt(i);
                }
                
                // Verify the processed video is valid (same size as original)
                if (processedBytes.length === bytes.length) {
                  blob = new Blob([processedBytes], { type: 'video/mp4' });
                  if (!silent) toast.success('Metadados de IA removidos!');
                } else {
                  console.warn('Size mismatch, using original');
                  if (!silent) toast.warning('Processamento falhou, usando original.');
                }
              } catch (decodeError) {
                console.error('Base64 decode failed:', decodeError);
                if (!silent) toast.warning('Erro no processamento, usando original.');
              }
            } else if (processData.error) {
              console.warn('Processing error:', processData.error);
              if (!silent) toast.warning('Não foi possível limpar metadados.');
            }
          } else {
            console.warn('Process response not ok:', processResponse.status);
            if (!silent) toast.warning('Erro no servidor, baixando original.');
          }
        } catch (processError) {
          console.warn('Metadata processing failed:', processError);
          if (!silent) toast.warning('Erro no processamento, baixando original.');
        }
        
        setProcessingMetadata(false);
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = cleanMetadata 
        ? `sora-clean-${Date.now()}.mp4`
        : `sora-video-${Date.now()}.mp4`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      if (!silent) toast.success('Download concluído!');
      return true;
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab
      window.open(videoUrl, '_blank');
      if (!silent) toast.info('Abrindo vídeo em nova aba.');
      return false;
    } finally {
      setDownloadingIndex(null);
      setProcessingMetadata(false);
    }
  };

  // Batch download all videos
  const handleDownloadAll = async () => {
    if (successfulVideos.length === 0) return;
    
    setDownloadingAll(true);
    setDownloadProgress({ current: 0, total: successfulVideos.length });
    
    let successCount = 0;
    
    for (let i = 0; i < successfulVideos.length; i++) {
      const video = successfulVideos[i];
      const originalIndex = videos.indexOf(video);
      
      setDownloadProgress({ current: i + 1, total: successfulVideos.length });
      toast.info(`Baixando vídeo ${i + 1} de ${successfulVideos.length}...`);
      
      const success = await handleDownload(video, originalIndex, true);
      if (success) successCount++;
      
      // Small delay between downloads to prevent overwhelming
      if (i < successfulVideos.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setDownloadingAll(false);
    setDownloadProgress({ current: 0, total: 0 });
    
    if (successCount === successfulVideos.length) {
      toast.success(`${successCount} vídeos baixados com sucesso!`);
    } else {
      toast.warning(`${successCount} de ${successfulVideos.length} vídeos baixados.`);
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

      {/* Download All Button */}
      {successfulVideos.length > 1 && (
        <Button 
          onClick={handleDownloadAll}
          disabled={downloadingAll || downloadingIndex !== null}
          className="w-full"
          size="lg"
        >
          {downloadingAll ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Baixando {downloadProgress.current}/{downloadProgress.total}...
            </>
          ) : (
            <>
              <DownloadCloud className="w-4 h-4 mr-2" />
              Baixar Todos ({successfulVideos.length} vídeos)
              {cleanMetadata && <span className="ml-1 text-xs opacity-75">• Sem metadados IA</span>}
            </>
          )}
        </Button>
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
                <Button 
                  onClick={() => handleDownload(video, index)} 
                  className="flex-1"
                  disabled={downloadingIndex !== null || downloadingAll}
                >
                  {downloadingIndex === index ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {processingMetadata ? 'Limpando...' : 'Baixando...'}
                    </>
                  ) : (
                    <>
                      {cleanMetadata ? (
                        <Smartphone className="w-4 h-4 mr-2" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      {cleanMetadata ? 'Baixar (Limpo)' : 'Baixar Vídeo'}
                    </>
                  )}
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