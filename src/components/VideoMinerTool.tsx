import { useState } from 'react';
import { VideoMinerInputStep } from './steps/VideoMinerInputStep';
import { VideoMinerLoadingStep } from './steps/VideoMinerLoadingStep';
import { VideoMinerResultStep } from './steps/VideoMinerResultStep';

export interface VideoResult {
  id: string;
  source: 'shopee' | 'aliexpress' | 'pinterest' | 'tiktok' | 'instagram' | 'facebook';
  videoUrl: string;
  thumbnailUrl: string;
  title: string;
  duration?: string;
  author?: string;
  sourceUrl?: string;
  isSearchLink?: boolean;
}

export interface MineResult {
  success: boolean;
  productName: string;
  keywords: string[];
  videos: VideoResult[];
  errors?: string[];
}

export interface SourcesConfig {
  shopee: boolean;
  aliexpress: boolean;
  pinterest: boolean;
  tiktok: boolean;
}

type Step = 'input' | 'loading' | 'results';

export const VideoMinerTool = () => {
  const [step, setStep] = useState<Step>('input');
  const [productUrl, setProductUrl] = useState('');
  const [sources, setSources] = useState<SourcesConfig>({
    shopee: true,
    aliexpress: true,
    pinterest: true,
    tiktok: false, // Disabled until API configured
  });
  const [mineResult, setMineResult] = useState<MineResult | null>(null);
  const [progress, setProgress] = useState<Record<string, 'pending' | 'searching' | 'done' | 'error'>>({});

  const handleStartMining = async (url: string, selectedSources: SourcesConfig) => {
    setProductUrl(url);
    setSources(selectedSources);
    setStep('loading');
    
    // Initialize progress
    const initialProgress: Record<string, 'pending' | 'searching' | 'done' | 'error'> = {};
    if (selectedSources.shopee) initialProgress.shopee = 'searching';
    if (selectedSources.aliexpress) initialProgress.aliexpress = 'pending';
    if (selectedSources.pinterest) initialProgress.pinterest = 'pending';
    setProgress(initialProgress);

    // Simulate progress updates
    const updateProgress = (source: string, status: 'pending' | 'searching' | 'done' | 'error') => {
      setProgress(prev => ({ ...prev, [source]: status }));
    };

    // Start searching animation
    setTimeout(() => {
      if (selectedSources.aliexpress) updateProgress('aliexpress', 'searching');
    }, 1000);
    setTimeout(() => {
      if (selectedSources.pinterest) updateProgress('pinterest', 'searching');
    }, 2000);
  };

  const handleMineComplete = (result: MineResult) => {
    setMineResult(result);
    
    // Update progress to done
    const doneProgress: Record<string, 'pending' | 'searching' | 'done' | 'error'> = {};
    if (sources.shopee) doneProgress.shopee = result.errors?.some(e => e.includes('Shopee')) ? 'error' : 'done';
    if (sources.aliexpress) doneProgress.aliexpress = result.errors?.some(e => e.includes('AliExpress')) ? 'error' : 'done';
    if (sources.pinterest) doneProgress.pinterest = result.errors?.some(e => e.includes('Pinterest')) ? 'error' : 'done';
    setProgress(doneProgress);

    setStep('results');
  };

  const handleReset = () => {
    setStep('input');
    setProductUrl('');
    setMineResult(null);
    setProgress({});
  };

  return (
    <div className="space-y-6">
      {step === 'input' && (
        <VideoMinerInputStep
          onStartMining={handleStartMining}
        />
      )}
      
      {step === 'loading' && (
        <VideoMinerLoadingStep
          productUrl={productUrl}
          sources={sources}
          progress={progress}
          onComplete={handleMineComplete}
        />
      )}
      
      {step === 'results' && mineResult && (
        <VideoMinerResultStep
          result={mineResult}
          onReset={handleReset}
        />
      )}
    </div>
  );
};
