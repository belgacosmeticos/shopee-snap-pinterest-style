import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PinGenTool } from './PinGenTool';
import { VideoGenTool } from './VideoGenTool';
import { SoraGenTool } from './SoraGenTool';
import { VideoMinerTool } from './VideoMinerTool';
import { ImageIcon, Video, Sparkles, Search } from 'lucide-react';
export const ToolsDashboard = () => {
  const [activeTab, setActiveTab] = useState('pingen');

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
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4 mb-6 h-12">
            <TabsTrigger value="pingen" className="gap-2 text-xs md:text-sm">
              <ImageIcon className="w-4 h-4" />
              <span className="hidden sm:inline">PinGen</span>
              <span className="sm:hidden">Pin</span>
            </TabsTrigger>
            <TabsTrigger value="videogen" className="gap-2 text-xs md:text-sm">
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline">VideoGen</span>
              <span className="sm:hidden">Video</span>
            </TabsTrigger>
            <TabsTrigger value="soragen" className="gap-2 text-xs md:text-sm">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">SoraGen</span>
              <span className="sm:hidden">Sora</span>
            </TabsTrigger>
            <TabsTrigger value="videominer" className="gap-2 text-xs md:text-sm">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">VideoMiner</span>
              <span className="sm:hidden">Miner</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pingen" className="mt-0 animate-fade-in">
            <PinGenTool />
          </TabsContent>

          <TabsContent value="videogen" className="mt-0 animate-fade-in">
            <VideoGenTool />
          </TabsContent>

          <TabsContent value="soragen" className="mt-0 animate-fade-in">
            <SoraGenTool />
          </TabsContent>

          <TabsContent value="videominer" className="mt-0 animate-fade-in">
            <VideoMinerTool />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
