import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PinGenTool } from './PinGenTool';
import { VideoGenTool } from './VideoGenTool';
import { SoraGenTool } from './SoraGenTool';
import { VideoMinerTool } from './VideoMinerTool';
import { SeedanceTool } from './SeedanceTool';
import { UsageAnalytics } from './UsageAnalytics';
import { ImageIcon, Video, Sparkles, Search, BarChart3, Clapperboard } from 'lucide-react';

export const ToolsDashboard = () => {
  const [activeTab, setActiveTab] = useState('videogen');

  return (
    <div className="min-h-screen gradient-soft">
      <div className="container max-w-5xl py-6 px-4">
        {/* Dashboard Header */}
        <header className="text-center mb-6 animate-slide-up">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            <span className="text-gradient">Content Tools</span>
          </h1>
          <p className="text-muted-foreground">
            Ferramentas para criadores de conteúdo
          </p>
        </header>

        {/* Tool Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-6 mb-6 h-12">
            <TabsTrigger value="videogen" className="gap-2 text-xs md:text-sm">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">VideoGen</span>
              <span className="sm:hidden">Video</span>
            </TabsTrigger>
            <TabsTrigger value="pingen" className="gap-2 text-xs md:text-sm">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">PinGen</span>
              <span className="sm:hidden">Pin</span>
            </TabsTrigger>
            <TabsTrigger value="soragen" className="gap-2 text-xs md:text-sm">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">SoraGen</span>
              <span className="sm:hidden">Sora</span>
            </TabsTrigger>
            <TabsTrigger value="seedance" className="gap-2 text-xs md:text-sm">
              <Clapperboard className="w-4 h-4" />
              <span className="hidden sm:inline">Seedance</span>
              <span className="sm:hidden">Seed</span>
            </TabsTrigger>
            <TabsTrigger value="videominer" className="gap-2 text-xs md:text-sm">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">VideoMiner</span>
              <span className="sm:hidden">Miner</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 text-xs md:text-sm">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videogen" className="mt-0 animate-fade-in">
            <VideoGenTool />
          </TabsContent>

          <TabsContent value="pingen" className="mt-0 animate-fade-in">
            <PinGenTool />
          </TabsContent>

          <TabsContent value="soragen" className="mt-0 animate-fade-in">
            <SoraGenTool />
          </TabsContent>

          <TabsContent value="seedance" className="mt-0 animate-fade-in">
            <SeedanceTool />
          </TabsContent>

          <TabsContent value="videominer" className="mt-0 animate-fade-in">
            <VideoMinerTool />
          </TabsContent>

          <TabsContent value="analytics" className="mt-0 animate-fade-in">
            <UsageAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
