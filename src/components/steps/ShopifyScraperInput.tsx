import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, AlertCircle } from 'lucide-react';

interface ShopifyScraperInputProps {
  onAdd: (url: string) => void;
  isLoading: boolean;
}

export const ShopifyScraperInput = ({ onAdd, isLoading }: ShopifyScraperInputProps) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Cole um link de produto');
      return;
    }
    setError('');
    onAdd(url.trim());
    setUrl('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1 relative">
        <Input
          type="url"
          placeholder="https://shopee.com.br/produto..."
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          disabled={isLoading}
          className="h-12 text-base"
        />
        {error && (
          <p className="text-destructive text-xs mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isLoading} size="lg" variant="gradient">
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Adicionar
      </Button>
    </form>
  );
};
