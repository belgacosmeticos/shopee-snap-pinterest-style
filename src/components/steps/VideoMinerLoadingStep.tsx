import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ShoppingCart, Package, Pin, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { MineResult, SourcesConfig } from '../VideoMinerTool';

interface VideoMinerLoadingStepProps {
  productUrl: string;
  sources: SourcesConfig;
  progress: Record<string, 'pending' | 'searching' | 'done' | 'error'>;
  onComplete: (result: MineResult) => void;
}

export const VideoMinerLoadingStep = ({
  productUrl,
  sources,
  progress,
  onComplete,
}: VideoMinerLoadingStepProps) => {
  useEffect(() => {
    const mineVideos = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('mine-product-videos', {
          body: { url: productUrl, sources },
        });

        if (error) {
          console.error('Mining error:', error);
          onComplete({
            success: false,
            productName: '',
            keywords: [],
            videos: [],
            errors: ['Erro ao minerar vídeos. Tente novamente.'],
          });
          return;
        }

        onComplete(data as MineResult);
      } catch (err) {
        console.error('Mining exception:', err);
        onComplete({
          success: false,
          productName: '',
          keywords: [],
          videos: [],
          errors: ['Erro inesperado. Tente novamente.'],
        });
      }
    };

    mineVideos();
  }, [productUrl, sources, onComplete]);

  const getProgressPercent = () => {
    const entries = Object.entries(progress);
    if (entries.length === 0) return 10;
    
    const doneCount = entries.filter(([_, status]) => status === 'done' || status === 'error').length;
    const searchingCount = entries.filter(([_, status]) => status === 'searching').length;
    
    return Math.round((doneCount * 100 + searchingCount * 50) / entries.length);
  };

  const sourceConfig = [
    { key: 'shopee', icon: ShoppingCart, label: 'Shopee', enabled: sources.shopee },
    { key: 'aliexpress', icon: Package, label: 'AliExpress', enabled: sources.aliexpress },
    { key: 'pinterest', icon: Pin, label: 'Pinterest', enabled: sources.pinterest },
  ];

  const getStatusIcon = (status: 'pending' | 'searching' | 'done' | 'error') => {
    switch (status) {
      case 'done':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case 'searching':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const getStatusText = (status: 'pending' | 'searching' | 'done' | 'error') => {
    switch (status) {
      case 'done':
        return 'Concluído';
      case 'error':
        return 'Erro';
      case 'searching':
        return 'Buscando...';
      default:
        return 'Aguardando';
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="text-center">
        <CardTitle className="text-xl flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          Minerando vídeos...
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="text-foreground">{getProgressPercent()}%</span>
          </div>
          <Progress value={getProgressPercent()} className="h-2" />
        </div>

        <div className="space-y-3">
          {sourceConfig.filter(s => s.enabled).map(({ key, icon: Icon, label }) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {getStatusText(progress[key] || 'pending')}
                </span>
                {getStatusIcon(progress[key] || 'pending')}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Isso pode levar alguns segundos...
        </p>
      </CardContent>
    </Card>
  );
};
