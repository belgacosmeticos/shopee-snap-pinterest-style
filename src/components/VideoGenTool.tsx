import { useState } from 'react';
import { VideoUrlInputStep } from './steps/VideoUrlInputStep';
import { VideoResultStep } from './steps/VideoResultStep';

export type VideoStep = 'input' | 'result';

export interface VideoProductData {
  title: string;
  affiliateLink?: string;
  originalLink?: string;
}

export interface ExtractedVideo {
  videoUrl: string | null;
  title: string | null;
  creator: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  caption?: string;
  captionFacebook?: string;
}

export const VideoGenTool = () => {
  const [currentStep, setCurrentStep] = useState<VideoStep>('input');
  const [productData, setProductData] = useState<VideoProductData | null>(null);
  const [videos, setVideos] = useState<ExtractedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (data: { 
    title: string; 
    affiliateLink?: string; 
    originalLink?: string;
    videos: ExtractedVideo[];
  }) => {
    setProductData({ 
      title: data.title, 
      affiliateLink: data.affiliateLink, 
      originalLink: data.originalLink 
    });
    setVideos(data.videos);
    setCurrentStep('result');
  };

  const handleReset = () => {
    setProductData(null);
    setVideos([]);
    setCurrentStep('input');
  };

  const handleUpdateVideos = (updatedVideos: ExtractedVideo[]) => {
    setVideos(updatedVideos);
  };

  return (
    <div className="py-4">
      {/* Progress Steps */}
      <div className="flex justify-center gap-2 mb-8">
        {['input', 'result'].map((step, index) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all duration-300 ${
              index <= ['input', 'result'].indexOf(currentStep)
                ? 'w-16 bg-coral'
                : 'w-8 bg-muted'
            }`}
          />
        ))}
      </div>

        {/* Step Content */}
        <main className="animate-fade-in">
          {currentStep === 'input' && (
            <VideoUrlInputStep 
              onSubmit={handleSubmit} 
              isLoading={isLoading} 
              setIsLoading={setIsLoading}
            />
          )}
          
          {currentStep === 'result' && productData && (
            <VideoResultStep
              productData={productData}
              videos={videos}
              onUpdateVideos={handleUpdateVideos}
              onReset={handleReset}
            />
          )}
        </main>
      </div>
  );
};
