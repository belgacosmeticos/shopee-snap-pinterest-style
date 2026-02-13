import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Clapperboard, Upload, X, Info, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MediaFile {
  url: string;
  name: string;
  preview?: string;
  type: 'image' | 'video' | 'url';
}

interface SeedanceInputStepProps {
  onGenerate: (data: {
    prompt: string;
    mediaFiles: string[];
    aspectRatio: string;
    duration: number;
    mode: string;
  }) => void;
  isLoading: boolean;
}

const ASPECT_RATIOS = ['16:9', '9:16', '1:1'];
const MODES = ['Fast', 'Standard'];

export const SeedanceInputStep = ({ onGenerate, isLoading }: SeedanceInputStepProps) => {
  const [prompt, setPrompt] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState([5]);
  const [mode, setMode] = useState('Fast');
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const uploadFile = useCallback(async (file: File): Promise<MediaFile | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('seedance-upload', {
        body: formData,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const isVideo = file.type.startsWith('video/');
      return {
        url: data.url,
        name: file.name,
        preview: isVideo ? undefined : data.url,
        type: isVideo ? 'video' : 'image',
      };
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(`Erro ao enviar ${file.name}`);
      return null;
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    const results = await Promise.all(fileArray.map(uploadFile));
    const successful = results.filter((r): r is MediaFile => r !== null);

    if (successful.length > 0) {
      setMediaFiles(prev => [...prev, ...successful]);
      toast.success(`${successful.length} arquivo(s) enviado(s)`);
    }
    setUploading(false);
  }, [uploadFile]);

  // Paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        await handleFiles(files);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      setMediaFiles(prev => [...prev, {
        url: urlInput.trim(),
        name: urlInput.trim().split('/').pop() || 'URL',
        type: 'url',
      }]);
      setUrlInput('');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate({
      prompt: prompt.trim(),
      mediaFiles: mediaFiles.map(m => m.url),
      aspectRatio,
      duration: duration[0],
      mode,
    });
  };

  return (
    <Card className="glass-card border-0 shadow-soft">
      <CardContent className="p-6 space-y-5">
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
            <Clapperboard className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-display font-bold">Seedance 2.0</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gere vídeos com IA usando o modelo Seedance da ByteDance
          </p>
        </div>

        {/* Prompt */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt *</Label>
          <Textarea
            id="prompt"
            placeholder="Descreva o vídeo que deseja gerar... Ex: Uma astronauta caminhando em Marte com o sol ao fundo"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] resize-none"
          />
        </div>

        {/* Media Files - Upload Area */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Mídia de referência (opcional)</Label>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Faça upload de imagens/vídeos, cole com Ctrl+V, ou adicione URLs. Use <code className="bg-muted px-1 rounded">@imagem1</code> no prompt para referenciar.
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Enviando...</span>
              </div>
            ) : (
              <div className="py-2">
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos, clique para selecionar ou <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+V</kbd> para colar
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">Imagens e vídeos</p>
              </div>
            )}
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ou cole uma URL de imagem/vídeo"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddUrl} disabled={!urlInput.trim()}>
              Adicionar
            </Button>
          </div>

          {/* Previews */}
          {mediaFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {mediaFiles.map((file, i) => (
                <div key={i} className="relative group">
                  {file.type === 'image' && file.preview ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1.5 rounded-lg text-xs max-w-[180px]">
                      <span className="truncate">@{i + 1}: {file.name}</span>
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveMedia(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <div className="flex gap-2">
            {ASPECT_RATIOS.map((ar) => (
              <Button
                key={ar}
                type="button"
                variant={aspectRatio === ar ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAspectRatio(ar)}
                className="flex-1"
              >
                {ar}
              </Button>
            ))}
          </div>
        </div>

        {/* Duration - now up to 15s */}
        <div className="space-y-2">
          <Label>Duração: {duration[0]}s</Label>
          <Slider
            value={duration}
            onValueChange={setDuration}
            min={5}
            max={15}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5s</span>
            <span>10s</span>
            <span>15s</span>
          </div>
        </div>

        {/* Mode */}
        <div className="space-y-2">
          <Label>Modo</Label>
          <div className="flex gap-2">
            {MODES.map((m) => (
              <Button
                key={m}
                type="button"
                variant={mode === m ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMode(m)}
                className="flex-1"
              >
                {m === 'Fast' ? '⚡ Fast' : '🎯 Standard'}
              </Button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || isLoading || uploading}
          variant="gradient"
          size="lg"
          className="w-full"
        >
          <Clapperboard className="w-5 h-5" />
          Gerar Vídeo
        </Button>
      </CardContent>
    </Card>
  );
};
