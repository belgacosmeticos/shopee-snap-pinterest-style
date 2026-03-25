import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShopifyScraperInput } from './steps/ShopifyScraperInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Trash2, ShoppingBag, Edit2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShopifyProduct, generateShopifyCSV, downloadCSV, createHandle } from '@/lib/shopifyCsvExport';

interface ScrapedProduct {
  title: string;
  images: string[];
  originalPrice: number;
  sellingPrice: number;
  description: string;
  affiliateLink?: string;
}

export const ShopifyScraperTool = () => {
  const [products, setProducts] = useState<ScrapedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddProduct = async (url: string) => {
    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('extract-shopee', {
        body: { url }
      });

      if (response.error || !response.data || response.data.error) {
        toast.error(response.data?.error || 'Erro ao extrair produto');
        return;
      }

      const data = response.data;
      const originalPrice = data.price || 0;

      setProducts(prev => [...prev, {
        title: data.title || 'Produto',
        images: data.images || [],
        originalPrice,
        sellingPrice: Math.round(originalPrice * 2 * 100) / 100,
        description: data.description || '',
        affiliateLink: data.affiliateLink,
      }]);

      toast.success(`"${data.title}" adicionado!`);
    } catch (err) {
      toast.error('Erro ao processar o link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = (index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateField = (index: number, field: keyof ScrapedProduct, value: string | number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleExport = () => {
    if (products.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    const shopifyProducts: ShopifyProduct[] = products.map((p, i) => ({
      handle: createHandle(p.title, i),
      title: p.title,
      description: p.description,
      vendor: 'Shopee',
      tags: '',
      price: p.sellingPrice,
      compareAtPrice: 0,
      images: p.images,
    }));

    const csv = generateShopifyCSV(shopifyProducts);
    downloadCSV(csv, `shopify-import-${Date.now()}.csv`);
    toast.success('CSV exportado com sucesso!');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 shadow-card gradient-card">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow">
            <ShoppingBag className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-display font-semibold mb-1">Shopify Scraper</h2>
          <p className="text-muted-foreground text-sm">
            Cole links de produtos Shopee para gerar CSV de importação Shopify
          </p>
        </div>

        <ShopifyScraperInput onAdd={handleAddProduct} isLoading={isLoading} />
      </Card>

      {products.length > 0 && (
        <Card className="p-4 shadow-card gradient-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">
              {products.length} produto{products.length > 1 ? 's' : ''}
            </h3>
            <Button onClick={handleExport} variant="gradient" size="sm">
              <Download className="w-4 h-4 mr-1" />
              Exportar CSV Shopify
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Foto</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-28">Preço Original</TableHead>
                  <TableHead className="w-28">Preço x2</TableHead>
                  <TableHead className="w-16">Imgs</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {product.images[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="w-12 h-12 object-cover rounded-md"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={product.title}
                          onChange={(e) => handleUpdateField(index, 'title', e.target.value)}
                          onBlur={() => setEditingIndex(null)}
                          autoFocus
                          className="h-8 text-xs"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingIndex(index)}
                          className="text-left text-xs line-clamp-2 hover:text-primary transition-colors"
                          title="Clique para editar"
                        >
                          {product.title}
                          <Edit2 className="w-3 h-3 inline ml-1 opacity-40" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {product.originalPrice > 0 ? `R$ ${product.originalPrice.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={product.sellingPrice}
                        onChange={(e) => handleUpdateField(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                        className="h-8 w-24 text-xs font-semibold"
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {product.images.length}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};
