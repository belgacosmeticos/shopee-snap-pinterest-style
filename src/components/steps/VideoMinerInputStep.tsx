import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, ShoppingCart, Package, Pin, Music } from 'lucide-react';
import type { SourcesConfig } from '../VideoMinerTool';

interface VideoMinerInputStepProps {
  onStartMining: (url: string, sources: SourcesConfig) => void;
}

export const VideoMinerInputStep = ({ onStartMining }: VideoMinerInputStepProps) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [sources, setSources] = useState<SourcesConfig>({
    shopee: true,
    aliexpress: true,
    pinterest: true,
    tiktok: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim()) {
      setError('Por favor, insira um link de produto.');
      return;
    }

    if (!url.includes('shopee.com') && !url.includes('s.shopee')) {
      setError('Por favor, insira um link válido da Shopee.');
      return;
    }

    // Check if at least one source is selected
    if (!sources.shopee && !sources.aliexpress && !sources.pinterest && !sources.tiktok) {
      setError('Selecione pelo menos uma fonte de vídeo.');
      return;
    }

    onStartMining(url, sources);
  };

  const toggleSource = (source: keyof SourcesConfig) => {
    if (source === 'tiktok') return; // TikTok disabled for now
    setSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          <span className="text-gradient">Video Miner</span>
        </CardTitle>
        <CardDescription>
          Encontre vídeos do seu produto em diversas fontes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-url">Link do Produto Shopee</Label>
            <Input
              id="product-url"
              type="text"
              placeholder="https://shopee.com.br/produto..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="bg-background/50"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Onde buscar vídeos</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SourceCheckbox
                id="shopee"
                icon={<ShoppingCart className="w-4 h-4" />}
                label="Shopee"
                description="Outras lojas vendendo"
                checked={sources.shopee}
                onCheckedChange={() => toggleSource('shopee')}
              />
              <SourceCheckbox
                id="aliexpress"
                icon={<Package className="w-4 h-4" />}
                label="AliExpress"
                description="Vídeo do fornecedor"
                checked={sources.aliexpress}
                onCheckedChange={() => toggleSource('aliexpress')}
              />
              <SourceCheckbox
                id="pinterest"
                icon={<Pin className="w-4 h-4" />}
                label="Pinterest"
                description="Pins de vídeo"
                checked={sources.pinterest}
                onCheckedChange={() => toggleSource('pinterest')}
              />
              <SourceCheckbox
                id="tiktok"
                icon={<Music className="w-4 h-4" />}
                label="TikTok"
                description="Em breve..."
                checked={sources.tiktok}
                onCheckedChange={() => toggleSource('tiktok')}
                disabled
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="gradient"
            className="w-full h-12 text-base"
          >
            <Search className="w-5 h-5 mr-2" />
            Minerar Vídeos
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

interface SourceCheckboxProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
}

const SourceCheckbox = ({
  id,
  icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: SourceCheckboxProps) => (
  <div
    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
      disabled
        ? 'opacity-50 cursor-not-allowed border-border/50 bg-muted/20'
        : checked
        ? 'border-primary/50 bg-primary/5'
        : 'border-border hover:border-primary/30 cursor-pointer'
    }`}
    onClick={() => !disabled && onCheckedChange()}
  >
    <Checkbox
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="pointer-events-none"
    />
    <div className="flex items-center gap-2 flex-1">
      <div className={`${checked ? 'text-primary' : 'text-muted-foreground'}`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${disabled ? 'text-muted-foreground' : ''}`}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
    </div>
  </div>
);
