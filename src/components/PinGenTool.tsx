import { useState } from 'react';
import { UrlInputStep } from './steps/UrlInputStep';
import { ImageSelectStep } from './steps/ImageSelectStep';
import { GenerateStep } from './steps/GenerateStep';
import { ResultStep } from './steps/ResultStep';
import type { PublishMode } from './PinterestModeToggle';

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
  const [publishMode, setPublishMode] = useState<PublishMode>('manual');

  const handleUrlSubmit = (data: { title: string; images: string[]; affiliateLink?: string; originalLink?: string }, mode: PublishMode) => {
    setProductData({ ...data, selectedImage: '' });
    setPublishMode(mode);
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
    <div className="min-h-screen gradient-soft">
      <div className="container max-w-4xl py-8 px-4">
        {/* Header */}
        <header className="text-center mb-10 animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-3">
            <span className="text-gradient">PinGen</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Transforme produtos Shopee em pins virais do Pinterest
          </p>
        </header>

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
            <UrlInputStep onSubmit={handleUrlSubmit} isLoading={isLoading} setIsLoading={setIsLoading} />
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
              publishMode={publishMode}
              onRegenerate={handleRegenerate}
              onReset={handleReset}
              onUpdateResult={setGeneratedResult}
            />
          )}
        </main>
      </div>
    </div>
  );
};
