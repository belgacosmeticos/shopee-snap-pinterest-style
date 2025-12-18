import { useState, useCallback } from 'react';
import { UrlInputStep } from './steps/UrlInputStep';
import { ImageSelectStep } from './steps/ImageSelectStep';
import { GenerateStep } from './steps/GenerateStep';
import { ResultStep } from './steps/ResultStep';
import { usePinterestAuth } from '@/hooks/usePinterestAuth';

export type Step = 'input' | 'select' | 'generate' | 'result';

export interface ProductData {
  title: string;
  images: string[];
  selectedImage: string;
  affiliateLink?: string;
  originalLink?: string;
}

export interface GeneratedImage {
  image: string;
  sceneUsed: string;
}

export interface GeneratedResult {
  images: GeneratedImage[];
  title: string;
  description: string;
}

export interface GenerationSettings {
  sceneIndex: number | null;
  customPrompt: string;
  quantity: number;
}

export const PinGenTool = () => {
  const [currentStep, setCurrentStep] = useState<Step>('input');
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);
  const [generationSettings, setGenerationSettings] = useState<GenerationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const pinterest = usePinterestAuth();
  
  const handleFetchBoards = useCallback(() => {
    pinterest.fetchBoards();
  }, [pinterest]);

  const handleUrlSubmit = (data: { title: string; images: string[]; affiliateLink?: string; originalLink?: string }) => {
    setProductData({ ...data, selectedImage: '' });
    setCurrentStep('select');
  };

  const handleImageSelect = (imageUrl: string) => {
    if (productData) {
      setProductData({ ...productData, selectedImage: imageUrl });
      setCurrentStep('generate');
    }
  };

  const handleGenerate = (result: GeneratedResult, settings: GenerationSettings) => {
    setGeneratedResult(result);
    setGenerationSettings(settings);
    setCurrentStep('result');
  };

  const handleRegenerate = () => {
    setCurrentStep('generate');
    setGeneratedResult(null);
  };

  const handleReset = () => {
    setProductData(null);
    setGeneratedResult(null);
    setGenerationSettings(null);
    setCurrentStep('input');
  };

  const handleBackToSelect = () => {
    setCurrentStep('select');
  };

  return (
    <div className="py-4">
      {/* Progress Steps */}
      <div className="flex justify-center gap-2 mb-8">
        {['input', 'select', 'generate', 'result'].map((step, index) => (
          <div
            key={step}
            className={`h-2 rounded-full transition-all duration-300 ${
              index <= ['input', 'select', 'generate', 'result'].indexOf(currentStep)
                ? 'w-12 bg-coral'
                : 'w-8 bg-muted'
            }`}
          />
        ))}
      </div>

        {/* Step Content */}
        <main className="animate-fade-in">
          {currentStep === 'input' && (
            <UrlInputStep 
              onSubmit={handleUrlSubmit} 
              isLoading={isLoading} 
              setIsLoading={setIsLoading}
              isPinterestConnected={pinterest.isConnected}
              isPinterestLoading={pinterest.isLoading}
              onPinterestConnectWithToken={pinterest.connectWithToken}
              onPinterestDisconnect={pinterest.disconnect}
            />
          )}
          
          {currentStep === 'select' && productData && (
            <ImageSelectStep 
              images={productData.images}
              title={productData.title}
              onSelect={handleImageSelect}
              onBack={handleReset}
            />
          )}
          
          {currentStep === 'generate' && productData && (
            <GenerateStep
              productData={productData}
              onGenerate={handleGenerate}
              onBack={handleBackToSelect}
              initialSettings={generationSettings}
            />
          )}
          
          {currentStep === 'result' && generatedResult && productData && generationSettings && (
            <ResultStep
              result={generatedResult}
              productData={productData}
              settings={generationSettings}
              onRegenerate={handleRegenerate}
              onReset={handleReset}
              onUpdateResult={setGeneratedResult}
              isPinterestConnected={pinterest.isConnected}
              pinterestBoards={pinterest.boards}
              isLoadingBoards={pinterest.isLoadingBoards}
              onFetchBoards={handleFetchBoards}
              onCreatePin={pinterest.createPin}
            />
          )}
        </main>
      </div>
  );
};
