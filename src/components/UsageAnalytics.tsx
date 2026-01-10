import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUsageTracker, ToolType } from '@/hooks/useUsageTracker';
import { BarChart3, Sparkles, Flame, Trash2, ImageIcon, Video, Search } from 'lucide-react';

const TOOL_CONFIG: Record<ToolType, { label: string; icon: React.ElementType; color: string }> = {
  pingen: { label: 'PinGen', icon: ImageIcon, color: 'hsl(var(--coral))' },
  videogen: { label: 'VideoGen', icon: Video, color: 'hsl(var(--rose))' },
  soragen: { label: 'SoraGen', icon: Sparkles, color: 'hsl(340 65% 55%)' },
  videominer: { label: 'VideoMiner', icon: Search, color: 'hsl(200 70% 50%)' },
};

const ACTION_LABELS: Record<string, string> = {
  image_generation: 'Imagem gerada',
  caption_generation: 'Legenda gerada',
  video_extraction: 'Vídeo extraído',
  video_mining: 'Mineração concluída',
};

export const UsageAnalytics = () => {
  const { getUsageStats, getUsageHistory, clearHistory } = useUsageTracker();

  const stats = useMemo(() => getUsageStats(7), [getUsageStats]);
  const recentHistory = useMemo(() => getUsageHistory(15), [getUsageHistory]);

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(3)}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Calculate max for bar chart
  const maxToolCost = Math.max(
    ...Object.values(stats.byTool).map(t => t.cost),
    0.001 // Prevent division by zero
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="gradient-card shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lovable AI</p>
                <p className="text-2xl font-bold text-gradient">
                  {formatCost(stats.byType.lovable_ai.cost)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.byType.lovable_ai.count} operações
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/10">
                <Flame className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Firecrawl</p>
                <p className="text-2xl font-bold" style={{ color: 'hsl(var(--accent))' }}>
                  {formatCost(stats.byType.firecrawl.cost)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.byType.firecrawl.count} scrapes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gradient-card shadow-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-secondary">
                <BarChart3 className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total (7 dias)</p>
                <p className="text-2xl font-bold">
                  {formatCost(stats.totalCost)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.totalOperations} operações
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Tool */}
      <Card className="gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Uso por Ferramenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.entries(TOOL_CONFIG) as [ToolType, typeof TOOL_CONFIG[ToolType]][]).map(([key, config]) => {
            const toolStats = stats.byTool[key];
            const percentage = stats.totalCost > 0 ? (toolStats.cost / stats.totalCost) * 100 : 0;
            const barWidth = maxToolCost > 0 ? (toolStats.cost / maxToolCost) * 100 : 0;
            const Icon = config.icon;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color: config.color }} />
                    <span className="font-medium text-sm">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {formatCost(toolStats.cost)}
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: config.color,
                    }}
                  />
                </div>
              </div>
            );
          })}

          {stats.totalOperations === 0 && (
            <p className="text-center text-muted-foreground text-sm py-4">
              Nenhum uso registrado nos últimos 7 dias
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Operations */}
      <Card className="gradient-card shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Operações Recentes</CardTitle>
          {recentHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentHistory.length > 0 ? (
            <div className="space-y-2">
              {recentHistory.map((record) => {
                const config = TOOL_CONFIG[record.tool];
                const Icon = config.icon;

                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                      <div>
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {ACTION_LABELS[record.action] || record.action}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        ~{formatCost(record.estimatedCost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(record.timestamp)} {formatTime(record.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-8">
              Nenhuma operação registrada ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Note */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          💡 Sobre os custos estimados
        </h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• <strong>Lovable AI:</strong> Imagens (~$0.015) e legendas (~$0.001)</li>
          <li>• <strong>Firecrawl:</strong> Scraping de páginas (~$0.005-0.02)</li>
          <li>• Os valores são estimativas e podem variar</li>
          <li>• Dados armazenados localmente no navegador</li>
        </ul>
      </div>
    </div>
  );
};
