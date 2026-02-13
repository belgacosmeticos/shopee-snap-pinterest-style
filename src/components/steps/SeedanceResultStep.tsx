import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, RotateCcw, CheckCircle2 } from 'lucide-react';

interface SeedanceResultStepProps {
  videoUrl: string;
  onReset: () => void;
}

export const SeedanceResultStep = ({ videoUrl, onReset }: SeedanceResultStepProps) => {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.target = '_blank';
    a.download = `seedance-video-${Date.now()}.mp4`;
    a.click();
  };

  return (
    <Card className="glass-card border-0 shadow-soft">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-display font-bold">Vídeo Gerado!</h2>
        </div>

        <div className="rounded-xl overflow-hidden bg-black/5">
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full max-h-[400px] object-contain"
          />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleDownload} variant="gradient" size="lg" className="flex-1">
            <Download className="w-5 h-5" />
            Baixar Vídeo
          </Button>
          <Button onClick={onReset} variant="outline" size="lg" className="flex-1">
            <RotateCcw className="w-5 h-5" />
            Gerar Novo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
