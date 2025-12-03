import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, RefreshCw, Home, Check, Download, ChevronLeft, ChevronRight, ExternalLink, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePinterestAuth } from '@/hooks/usePinterestAuth';
import { PinterestModeToggle, PublishMode } from '../PinterestModeToggle';
import type { GeneratedResult, ProductData, GenerationSettings } from '../PinGenTool';

// Pinterest SVG icon
const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

interface ResultStepProps {
  result: GeneratedResult;
  productData: ProductData;
  settings: GenerationSettings;
  onRegenerate: () => void;
  onReset: () => void;
  onUpdateResult: (result: GeneratedResult) => void;
}

export const ResultStep = ({ result, productData, settings, onRegenerate, onReset, onUpdateResult }: ResultStepProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false);
  const [isRegeneratingDesc, setIsRegeneratingDesc] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishMode>('manual');

  const pinterest = usePinterestAuth();
  const currentImage = result.images[currentImageIndex];
  const hasMultipleImages = result.images.length > 1;

  // Fetch boards when in Pinterest mode
  useEffect(() => {
    if (publishMode === 'pinterest' && pinterest.isConnected && pinterest.boards.length === 0) {
      pinterest.fetchBoards();
    }
  }, [publishMode, pinterest.isConnected]);

  const handleCopy = async (text: string, type: 'title' | 'desc' | 'link') => {
    await navigator.clipboard.writeText(text);
    if (type === 'title') {
      setCopiedTitle(true);
      setTimeout(() => setCopiedTitle(false), 2000);
    } else if (type === 'desc') {
      setCopiedDesc(true);
      setTimeout(() => setCopiedDesc(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast.success('Copiado!');
  };

  const handleSharePinterest = () => {
    const pinterestUrl = `https://www.pinterest.com/pin-builder/?description=${encodeURIComponent(result.description)}`;
    window.open(pinterestUrl, '_blank');
    toast.info('Baixe a imagem e faça upload no Pinterest');
  };

  const handlePublishToPinterest = async () => {
    if (!selectedBoardId) {
      toast.error('Selecione um board primeiro');
      return;
    }

    setIsPublishing(true);
    try {
      // Build description with affiliate link if available
      let fullDescription = result.description;
      if (productData.affiliateLink) {
        fullDescription += `\n\n🛒 Compre aqui: ${productData.affiliateLink}`;
      }

      const pin = await pinterest.createPin({
        boardId: selectedBoardId,
        title: result.title,
        description: fullDescription,
        link: productData.affiliateLink || productData.originalLink,
        imageBase64: currentImage.image,
      });

      toast.success('Pin publicado com sucesso! 🎉');
      console.log('[ResultStep] Pin created:', pin);
    } catch (err: any) {
      console.error('[ResultStep] Publish error:', err);
      toast.error(err.message || 'Erro ao publicar pin');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDownload = async (imageUrl: string, index?: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pinterest-${Date.now()}${index !== undefined ? `-${index + 1}` : ''}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Imagem baixada!');
    } catch (err) {
      window.open(imageUrl, '_blank');
    }
  };

  const handleRegenerateCurrentImage = async () => {
    setIsRegeneratingImage(true);
    try {
      const { data: imageData, error: imageError } = await supabase.functions.invoke('generate-pinterest-image', {
        body: {
          imageUrl: productData.selectedImage,
          productTitle: productData.title,
          customPrompt: settings.customPrompt || undefined,
          sceneIndex: settings.sceneIndex ?? undefined,
        }
      });

      if (imageError) throw imageError;
      if (imageData.error) throw new Error(imageData.error);

      const newImages = [...result.images];
      newImages[currentImageIndex] = {
        image: imageData.image,
        sceneUsed: imageData.sceneUsed,
      };

      onUpdateResult({
        ...result,
        images: newImages,
      });

      toast.success('Imagem regenerada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao regenerar imagem');
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleRegenerateTitle = async () => {
    setIsRegeneratingTitle(true);
    try {
      const { data: captionData, error: captionError } = await supabase.functions.invoke('generate-pinterest-caption', {
        body: {
          productTitle: productData.title,
          sceneDescription: currentImage.sceneUsed,
          regenerateTitle: true,
        }
      });

      if (captionError) throw captionError;

      onUpdateResult({
        ...result,
        title: captionData?.title || result.title,
      });

      toast.success('Título regenerado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao regenerar título');
    } finally {
      setIsRegeneratingTitle(false);
    }
  };

  const handleRegenerateDescription = async () => {
    setIsRegeneratingDesc(true);
    try {
      const { data: captionData, error: captionError } = await supabase.functions.invoke('generate-pinterest-caption', {
        body: {
          productTitle: productData.title,
          sceneDescription: currentImage.sceneUsed,
          regenerateDescription: true,
        }
      });

      if (captionError) throw captionError;

      onUpdateResult({
        ...result,
        description: captionData?.description || result.description,
      });

      toast.success('Legenda regenerada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao regenerar legenda');
    } finally {
      setIsRegeneratingDesc(false);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % result.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + result.images.length) % result.images.length);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Generated Image Card */}
      <Card className="p-4 md:p-6 shadow-card gradient-card">
        <h2 className="text-xl md:text-2xl font-display font-semibold mb-4 text-center">
          🎉 {result.images.length === 1 ? 'Sua imagem está pronta!' : `${result.images.length} imagens prontas!`}
        </h2>
        
        {/* Image Display */}
        <div className="relative max-w-sm mx-auto mb-4">
          {/* Navigation Arrows */}
          {hasMultipleImages && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 md:-translate-x-5 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1.5 md:p-2 shadow-lg hover:bg-background transition-colors"
              >
                <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 md:translate-x-5 z-10 bg-background/80 backdrop-blur-sm rounded-full p-1.5 md:p-2 shadow-lg hover:bg-background transition-colors"
              >
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </>
          )}

          {/* Image Container */}
          <div className="relative aspect-[9/16] rounded-2xl overflow-hidden shadow-glow">
            <img
              src={currentImage.image}
              alt={`Generated Pinterest Image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Regenerate Image Button */}
            <button
              onClick={handleRegenerateCurrentImage}
              disabled={isRegeneratingImage}
              className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-full p-2 shadow-lg hover:bg-background transition-colors disabled:opacity-50"
              title="Regenerar esta imagem"
            >
              <RefreshCw className={`w-4 h-4 ${isRegeneratingImage ? 'animate-spin' : ''}`} />
            </button>

            {/* Image Counter */}
            {hasMultipleImages && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
                {currentImageIndex + 1} / {result.images.length}
              </div>
            )}
          </div>
        </div>

        {/* Image Thumbnails */}
        {hasMultipleImages && (
          <div className="flex justify-center gap-2 mb-4 overflow-x-auto pb-2">
            {result.images.map((img, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`flex-shrink-0 w-12 h-16 md:w-14 md:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentImageIndex ? 'border-coral scale-105' : 'border-border opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img.image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Publish Mode Toggle */}
        <div className="mb-4">
          <PinterestModeToggle
            mode={publishMode}
            onModeChange={setPublishMode}
            isConnected={pinterest.isConnected}
            isLoading={pinterest.isLoading}
            onConnect={pinterest.connect}
            onConnectWithToken={pinterest.connectWithToken}
            onDisconnect={pinterest.disconnect}
          />
        </div>

        {/* Pinterest Mode: Board Selection & Publish */}
        {publishMode === 'pinterest' && pinterest.isConnected && (
          <div className="mb-4 p-4 rounded-lg bg-[#E60023]/5 border border-[#E60023]/20">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <PinterestIcon />
              Publicar no Pinterest
            </h4>
            
            <div className="space-y-3">
              <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder={pinterest.isLoadingBoards ? "Carregando boards..." : "Selecione um board"} />
                </SelectTrigger>
                <SelectContent>
                  {pinterest.boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="pinterest"
                className="w-full gap-2"
                onClick={handlePublishToPinterest}
                disabled={isPublishing || !selectedBoardId || pinterest.isLoadingBoards}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <PinterestIcon />
                    Publicar Pin
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 md:gap-3 justify-center flex-wrap">
          {publishMode === 'manual' && (
            <Button variant="pinterest" size="default" onClick={handleSharePinterest} className="gap-2">
              <PinterestIcon />
              <span className="hidden sm:inline">Publicar</span>
            </Button>
          )}
          <Button variant="secondary" size="default" onClick={() => handleDownload(currentImage.image, currentImageIndex)}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Baixar</span>
          </Button>
          {hasMultipleImages && (
            <Button variant="outline" size="default" onClick={() => result.images.forEach((img, i) => handleDownload(img.image, i))}>
              <Download className="w-4 h-4" />
              <span className="ml-2">Baixar Todas</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Affiliate Link Card */}
      {productData.affiliateLink && (
        <Card className="p-4 md:p-6 shadow-card border-2 border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="text-lg font-display font-semibold text-green-700 dark:text-green-400">
              Link de Afiliado
            </h3>
          </div>
          
          <div className="flex gap-2">
            <Input
              value={productData.affiliateLink}
              readOnly
              className="flex-1 bg-background text-sm font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(productData.affiliateLink, '_blank')}
              title="Abrir link"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => handleCopy(productData.affiliateLink!, 'link')}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Use este link para ganhar comissão nas vendas. Inclua na descrição do seu pin!
          </p>
        </Card>
      )}

      {/* Title & Caption Card */}
      <Card className="p-4 md:p-6 shadow-card">
        <h3 className="text-lg font-display font-semibold mb-4">Título e Legenda</h3>
        
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Título (para o Pinterest)
            </label>
            <div className="flex gap-2">
              <Input
                value={result.title}
                readOnly
                className="flex-1 bg-secondary/50 text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleRegenerateTitle}
                disabled={isRegeneratingTitle}
                title="Regenerar título"
              >
                <RefreshCw className={`w-4 h-4 ${isRegeneratingTitle ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(result.title, 'title')}
              >
                {copiedTitle ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Legenda (descrição do pin)
            </label>
            <div className="flex gap-2">
              <Textarea
                value={result.description}
                readOnly
                className="flex-1 bg-secondary/50 min-h-[80px] md:min-h-[100px] text-sm"
              />
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRegenerateDescription}
                  disabled={isRegeneratingDesc}
                  title="Regenerar legenda"
                >
                  <RefreshCw className={`w-4 h-4 ${isRegeneratingDesc ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(result.description, 'desc')}
                >
                  {copiedDesc ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button variant="soft" onClick={onRegenerate} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Gerar Novas Imagens
        </Button>
        <Button variant="ghost" onClick={onReset} className="gap-2">
          <Home className="w-4 h-4" />
          Criar Novo Pin
        </Button>
      </div>
    </div>
  );
};
