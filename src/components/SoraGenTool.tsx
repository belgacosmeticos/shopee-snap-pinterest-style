import { useState } from 'react';
import { SoraUrlInputStep } from './steps/SoraUrlInputStep';
import { SoraResultStep } from './steps/SoraResultStep';

type SoraStep = 'input' | 'result';

export interface SoraVideoData {
  videoUrl: string | null;
  videoUrlNoWatermark: string | null;
  title: string | null;
  prompt: string | null;
  thumbnailUrl: string | null;
  creator: string | null;
  originalUrl: string;
  hasWatermark: boolean;
  success: boolean;
  error?: string;
}

export const SoraGenTool = () => {
  const [currentStep, setCurrentStep] = useState<SoraStep>('input');
  const [videos, setVideos] = useState<SoraVideoData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cleanMetadata, setCleanMetadata] = useState(true);

  const handleSubmit = async (data: SoraVideoData[]) => {
    setVideos(data);
    setCurrentStep('result');
    setIsLoading(false);
  };

  const handleReset = () => {
    setCurrentStep('input');
    setVideos([]);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {currentStep === 'input' && (
        <SoraUrlInputStep 
          onSubmit={handleSubmit} 
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          cleanMetadata={cleanMetadata}
          setCleanMetadata={setCleanMetadata}
        />
      )}

      {currentStep === 'result' && videos.length > 0 && (
        <SoraResultStep
          videos={videos}
          onReset={handleReset}
          cleanMetadata={cleanMetadata}
        />
      )}
    </div>
  );
};
