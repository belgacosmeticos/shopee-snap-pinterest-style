import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link2, User, Download, Search } from 'lucide-react';

interface Props {
  onSingleDownload: (url: string) => void;
  onProfileScrape: (username: string, limit: number) => void;
}

export const TikTokInputStep = ({ onSingleDownload, onProfileScrape }: Props) => {
  const [link, setLink] = useState('');
  const [username, setUsername] = useState('');
  const [limit, setLimit] = useState(30);

  return (
    <Card className="glass-card border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          TikTok Downloader (sem marca d'água)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="w-4 h-4" /> Link único
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" /> Perfil completo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <div className="space-y-2">
              <Label>URL do vídeo TikTok</Label>
              <Input
                placeholder="https://www.tiktok.com/@usuario/video/..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!link.trim()}
              onClick={() => onSingleDownload(link.trim())}
            >
              <Download className="w-4 h-4 mr-2" /> Baixar vídeo
            </Button>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <div className="space-y-2">
              <Label>Usuário (@) ou URL do perfil</Label>
              <Input
                placeholder="@nomedeusuario ou https://www.tiktok.com/@nomedeusuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantos vídeos buscar (máx 100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(Math.min(100, Math.max(1, Number(e.target.value) || 30)))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!username.trim()}
              onClick={() => onProfileScrape(username.trim(), limit)}
            >
              <Search className="w-4 h-4 mr-2" /> Buscar vídeos do perfil
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
