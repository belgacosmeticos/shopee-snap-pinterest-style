import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, RotateCcw, Eye, Heart, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { TikTokVideo } from '../TikTokTool';

interface Props {
  username: string;
  videos: TikTokVideo[];
  onReset: () => void;
}

const formatNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

type SortKey = 'plays' | 'likes' | 'recent';

export const TikTokProfileResultStep = ({ username, videos, onReset }: Props) => {
  const [sortBy, setSortBy] = useState<SortKey>('plays');
  const [minViews, setMinViews] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const filtered = useMemo(() => {
    const list = videos.filter(v => (v.stats.plays || 0) >= minViews);
    return list.sort((a, b) => {
      if (sortBy === 'plays') return (b.stats.plays || 0) - (a.stats.plays || 0);
      if (sortBy === 'likes') return (b.stats.likes || 0) - (a.stats.likes || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [videos, sortBy, minViews]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(v => v.id)));
  };

  const downloadOne = async (v: TikTokVideo, idx: number) => {
    const sourceUrl = v.downloadUrl || v.url;
    if (!sourceUrl) {
      toast.error('Vídeo sem URL disponível');
      return;
    }
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tiktok-proxy-download?url=${encodeURIComponent(sourceUrl)}`;
    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('proxy falhou');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${username}-${idx + 1}-${v.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[downloadOne] erro', err);
      toast.error('Falha ao baixar vídeo');
    }
  };

  const downloadSelected = async () => {
    const list = filtered.filter(v => selected.has(v.id));
    if (!list.length) {
      toast.error('Selecione ao menos 1 vídeo');
      return;
    }
    setDownloading(true);
    setProgress({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      await downloadOne(list[i], i);
      setProgress({ done: i + 1, total: list.length });
      await new Promise(r => setTimeout(r, 400)); // throttle
    }
    setDownloading(false);
    toast.success(`${list.length} vídeo(s) baixado(s)`);
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle>@{username} — {filtered.length} vídeo(s)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Ordenar por</Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plays">Mais vistos</SelectItem>
                <SelectItem value="likes">Mais curtidos</SelectItem>
                <SelectItem value="recent">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Views mínimas</Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              value={minViews}
              onChange={(e) => setMinViews(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
          <Button variant="outline" onClick={toggleAll}>
            {selected.size === filtered.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
          <Button
            onClick={downloadSelected}
            disabled={downloading || selected.size === 0}
            className="ml-auto"
          >
            {downloading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {progress.done}/{progress.total}</>
            ) : (
              <><Download className="w-4 h-4 mr-2" /> Baixar {selected.size} selecionado(s)</>
            )}
          </Button>
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" /> Nova busca
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((v) => {
            const isSel = selected.has(v.id);
            return (
              <div
                key={v.id}
                className={`relative rounded-lg overflow-hidden border bg-muted/20 cursor-pointer transition ${
                  isSel ? 'border-primary ring-2 ring-primary' : 'border-white/10'
                }`}
                onClick={() => toggle(v.id)}
              >
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox checked={isSel} onCheckedChange={() => toggle(v.id)} />
                </div>
                <div className="aspect-[9/16] bg-black">
                  {v.cover && (
                    <img
                      src={v.cover}
                      alt={v.desc.slice(0, 60)}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-xs line-clamp-2 min-h-[2rem]">{v.desc || '—'}</p>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{formatNum(v.stats.plays)}</span>
                    <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{formatNum(v.stats.likes)}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{formatNum(v.stats.comments)}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); downloadOne(v, 0); }}
                  >
                    <Download className="w-3 h-3 mr-1" /> Baixar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
