import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RotateCcw, Eye, Heart } from 'lucide-react';
import type { TikTokSingleResult } from '../TikTokTool';

interface Props {
  video: TikTokSingleResult;
  onReset: () => void;
}

const formatNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

export const TikTokSingleResultStep = ({ video, onReset }: Props) => {
  const handleDownload = async () => {
    try {
      const res = await fetch(video.downloadUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tiktok-${video.id || Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(video.downloadUrl, '_blank');
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle className="text-lg">{video.title || 'Vídeo TikTok'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <video
          src={video.downloadUrl}
          poster={video.cover}
          controls
          className="w-full max-h-[60vh] rounded-lg bg-black"
        />
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {formatNum(video.stats.plays)}</span>
          <span className="flex items-center gap-1"><Heart className="w-4 h-4" /> {formatNum(video.stats.likes)}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDownload} className="flex-1">
            <Download className="w-4 h-4 mr-2" /> Baixar MP4 (sem marca d'água)
          </Button>
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Nova busca
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
