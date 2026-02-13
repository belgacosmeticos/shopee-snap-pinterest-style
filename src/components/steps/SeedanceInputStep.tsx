import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Clapperboard, Plus, X, Info } from 'lucide-react';

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
  const [mediaFiles, setMediaFiles] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState([5]);
  const [mode, setMode] = useState('Fast');

  const handleAddMedia = () => {
    if (mediaInput.trim()) {
      setMediaFiles(prev => [...prev, mediaInput.trim()]);
      setMediaInput('');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onGenerate({
      prompt: prompt.trim(),
      mediaFiles,
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

        {/* Media Files */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label>Mídia de referência (opcional)</Label>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Use <code className="bg-muted px-1 rounded">@imagem1</code> ou <code className="bg-muted px-1 rounded">@video1</code> no prompt para referenciar os arquivos adicionados.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="URL da imagem ou vídeo de referência"
              value={mediaInput}
              onChange={(e) => setMediaInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMedia()}
            />
            <Button type="button" variant="outline" size="icon" onClick={handleAddMedia} disabled={!mediaInput.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {mediaFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {mediaFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg text-xs max-w-[200px]">
                  <span className="truncate">@{i + 1}: {file}</span>
                  <button onClick={() => handleRemoveMedia(i)} className="text-muted-foreground hover:text-foreground shrink-0">
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

        {/* Duration */}
        <div className="space-y-2">
          <Label>Duração: {duration[0]}s</Label>
          <Slider
            value={duration}
            onValueChange={setDuration}
            min={5}
            max={10}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5s</span>
            <span>10s</span>
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
          disabled={!prompt.trim() || isLoading}
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
