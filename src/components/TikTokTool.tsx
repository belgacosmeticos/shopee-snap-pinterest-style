import { useState } from 'react';
import { TikTokInputStep } from './steps/TikTokInputStep';
import { TikTokSingleResultStep } from './steps/TikTokSingleResultStep';
import { TikTokProfileResultStep } from './steps/TikTokProfileResultStep';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type TikTokMode = 'link' | 'profile';

export interface TikTokVideo {
  id: string;
  url?: string;
  desc: string;
  cover: string;
  downloadUrl: string;
  duration?: number;
  createdAt?: string | null;
  stats: { plays: number; likes: number; comments: number; shares: number };
  author?: { name?: string; nickname?: string; avatar?: string };
}

export interface TikTokSingleResult {
  id: string;
  title: string;
  cover: string;
  downloadUrl: string;
  duration?: number;
  author?: any;
  stats: { plays: number; likes: number; comments: number; shares: number };
}

type Step = 'input' | 'loading' | 'single-result' | 'profile-result';

export const TikTokTool = () => {
  const [step, setStep] = useState<Step>('input');
  const [singleResult, setSingleResult] = useState<TikTokSingleResult | null>(null);
  const [profileVideos, setProfileVideos] = useState<TikTokVideo[]>([]);
  const [profileUsername, setProfileUsername] = useState('');

  const handleSingleDownload = async (url: string) => {
    setStep('loading');
    try {
      const { data, error } = await supabase.functions.invoke('tiktok-download-single', {
        body: { url },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha ao baixar');
      setSingleResult(data.video);
      setStep('single-result');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro desconhecido');
      setStep('input');
    }
  };

  const handleProfileScrape = async (username: string, limit: number) => {
    setStep('loading');
    setProfileUsername(username);
    try {
      const { data, error } = await supabase.functions.invoke('tiktok-scrape-profile', {
        body: { username, limit },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha ao buscar perfil');
      if (!data.videos?.length) {
        toast.warning('Nenhum vídeo encontrado para esse perfil');
        setStep('input');
        return;
      }
      setProfileVideos(data.videos);
      setStep('profile-result');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro desconhecido');
      setStep('input');
    }
  };

  const handleReset = () => {
    setStep('input');
    setSingleResult(null);
    setProfileVideos([]);
    setProfileUsername('');
  };

  if (step === 'loading') {
    return (
      <Card className="glass-card border-white/10">
        <CardContent className="py-16 text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Processando... isso pode levar alguns segundos</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {step === 'input' && (
        <TikTokInputStep
          onSingleDownload={handleSingleDownload}
          onProfileScrape={handleProfileScrape}
        />
      )}
      {step === 'single-result' && singleResult && (
        <TikTokSingleResultStep video={singleResult} onReset={handleReset} />
      )}
      {step === 'profile-result' && (
        <TikTokProfileResultStep
          username={profileUsername}
          videos={profileVideos}
          onReset={handleReset}
        />
      )}
    </div>
  );
};
