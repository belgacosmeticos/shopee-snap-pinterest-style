import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Search,
  Download,
  Play,
  ExternalLink,
  RotateCcw,
  ShoppingCart,
  Package,
  Pin,
  Music,
  AlertCircle,
  Video,
  CheckCircle2,
  Youtube,
  Instagram,
} from 'lucide-react';
import type { MineResult, VideoResult } from '../VideoMinerTool';
import { toast } from 'sonner';

interface VideoMinerResultStepProps {
  result: MineResult;
  onReset: () => void;
}

type SourceFilter = 'all' | 'shopee' | 'aliexpress' | 'pinterest' | 'tiktok' | 'youtube' | 'instagram';

export const VideoMinerResultStep = ({ result, onReset }: VideoMinerResultStepProps) => {
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [cleanMetadata, setCleanMetadata] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const filteredVideos = result.videos.filter(
    (video) => filter === 'all' || video.source === filter
  );

  const getSourceIcon = (source: VideoResult['source']) => {
    switch (source) {
      case 'shopee':
        return <ShoppingCart className="w-4 h-4" />;
      case 'aliexpress':
        return <Package className="w-4 h-4" />;
      case 'pinterest':
        return <Pin className="w-4 h-4" />;
      case 'tiktok':
        return <Music className="w-4 h-4" />;
      case 'youtube':
        return <Youtube className="w-4 h-4" />;
      case 'instagram':
        return <Instagram className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  const getSourceLabel = (source: VideoResult['source']) => {
    switch (source) {
      case 'shopee':
        return 'Shopee';
      case 'aliexpress':
        return 'AliExpress';
      case 'pinterest':
        return 'Pinterest';
      case 'tiktok':
        return 'TikTok';
      case 'youtube':
        return 'YouTube';
      case 'instagram':
        return 'Instagram';
      default:
        return source;
    }
  };

  const getSourceColor = (source: VideoResult['source']) => {
    switch (source) {
      case 'shopee':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'aliexpress':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'pinterest':
        return 'bg-red-600/20 text-red-500 border-red-600/30';
      case 'tiktok':
        return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      case 'youtube':
        return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'instagram':
        return 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-pink-400 border-pink-500/30';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allIds = new Set(filteredVideos.map((v) => v.id));
    setSelectedVideos(allIds);
  };

  const deselectAll = () => {
    setSelectedVideos(new Set());
  };

  const handleDownload = async (video: VideoResult) => {
    try {
      toast.loading('Baixando vídeo...', { id: video.id });

      const response = await fetch(video.videoUrl);
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_${video.source}_${video.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Vídeo baixado!', { id: video.id });
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erro ao baixar vídeo', { id: video.id });
    }
  };

  const handleDownloadSelected = async () => {
    const videosToDownload = filteredVideos.filter((v) => selectedVideos.has(v.id));
    
    if (videosToDownload.length === 0) {
      toast.error('Selecione pelo menos um vídeo');
      return;
    }

    toast.info(`Baixando ${videosToDownload.length} vídeos...`);

    for (const video of videosToDownload) {
      await handleDownload(video);
    }
  };

  const sourceCounts = result.videos.reduce(
    (acc, video) => {
      acc[video.source] = (acc[video.source] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Resultados da Mineração
            </CardTitle>
            <CardDescription className="mt-1">
              {result.productName && (
                <span className="font-medium">{result.productName}</span>
              )}
              {result.keywords.length > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  • Keywords: {result.keywords.slice(0, 3).join(', ')}
                </span>
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Nova Busca
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Errors */}
        {result.errors && result.errors.length > 0 && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Alguns erros ocorreram:</span>
            </div>
            <ul className="mt-2 text-sm text-destructive/80 list-disc list-inside">
              {result.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos ({result.videos.length})
          </Button>
          {Object.entries(sourceCounts).map(([source, count]) => (
            <Button
              key={source}
              variant={filter === source ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(source as SourceFilter)}
              className="gap-1"
            >
              {getSourceIcon(source as VideoResult['source'])}
              {getSourceLabel(source as VideoResult['source'])} ({count})
            </Button>
          ))}
        </div>

        {/* Video Grid */}
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <Video className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhum vídeo encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Tente buscar com outras fontes ou outro produto
            </p>
          </div>
        ) : (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Selecionar todos
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Limpar seleção
                </Button>
                {selectedVideos.size > 0 && (
                  <Badge variant="secondary">
                    {selectedVideos.size} selecionado(s)
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className={`relative rounded-lg border bg-card overflow-hidden transition-all ${
                    selectedVideos.has(video.id)
                      ? 'border-primary ring-1 ring-primary/50'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  {/* Thumbnail/Video Preview */}
                  <div className="relative aspect-video bg-muted">
                    {playingVideo === video.id ? (
                      <video
                        src={video.videoUrl}
                        controls
                        autoPlay
                        className="w-full h-full object-cover"
                        onEnded={() => setPlayingVideo(null)}
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center cursor-pointer group"
                        onClick={() => setPlayingVideo(video.id)}
                      >
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-12 h-12 text-muted-foreground/50" />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-12 h-12 text-white" />
                        </div>
                      </div>
                    )}

                    {/* Selection checkbox */}
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedVideos.has(video.id)}
                        onCheckedChange={() => toggleVideoSelection(video.id)}
                        className="bg-background/80 border-2"
                      />
                    </div>

                    {/* Source badge */}
                    <Badge
                      className={`absolute top-2 right-2 ${getSourceColor(video.source)}`}
                    >
                      {getSourceIcon(video.source)}
                      <span className="ml-1">{getSourceLabel(video.source)}</span>
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-medium truncate">{video.title}</p>
                    {video.duration && (
                      <p className="text-xs text-muted-foreground">{video.duration}</p>
                    )}

                    <div className="flex gap-2">
                      {video.isSearchLink ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(video.videoUrl, '_blank')}
                        >
                          <Search className="w-4 h-4 mr-1" />
                          Abrir Busca
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDownload(video)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Baixar
                        </Button>
                      )}
                      {video.sourceUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(video.sourceUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Download options */}
        {filteredVideos.length > 0 && (
          <div className="pt-4 border-t space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="clean-metadata"
                checked={cleanMetadata}
                onCheckedChange={setCleanMetadata}
              />
              <Label htmlFor="clean-metadata" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Limpar metadados + iPhone 16 Pro Max
              </Label>
            </div>

            <Button
              variant="gradient"
              className="w-full"
              onClick={handleDownloadSelected}
              disabled={selectedVideos.size === 0}
            >
              <Download className="w-5 h-5 mr-2" />
              Baixar Selecionados ({selectedVideos.size})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
