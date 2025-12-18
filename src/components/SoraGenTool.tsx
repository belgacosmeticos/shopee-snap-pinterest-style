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
  const [videoData, setVideoData] = useState<SoraVideoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: SoraVideoData) => {
    setVideoData(data);
    setCurrentStep('result');
    setIsLoading(false);
  };

  const handleReset = () => {
    setCurrentStep('input');
    setVideoData(null);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {currentStep === 'input' && (
        <SoraUrlInputStep 
          onSubmit={handleSubmit} 
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      )}

      {currentStep === 'result' && videoData && (
        <SoraResultStep
          videoData={videoData}
          onReset={handleReset}
        />
      )}
    </div>
  );
};
