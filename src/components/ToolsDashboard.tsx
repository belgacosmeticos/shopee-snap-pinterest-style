import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PinGenTool } from './PinGenTool';
import { VideoGenTool } from './VideoGenTool';
import { ImageIcon, Video } from 'lucide-react';

export const ToolsDashboard = () => {
  const [activeTab, setActiveTab] = useState('pingen');

  return (
    <div className="min-h-screen gradient-soft">
      <div className="container max-w-5xl py-6 px-4">
        {/* Dashboard Header */}
        <header className="text-center mb-6 animate-slide-up">
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">
            <span className="text-gradient">Shopee Tools</span>
          </h1>
          <p className="text-muted-foreground">
            Ferramentas para criadores de conteúdo afiliados
          </p>
        </header>

        {/* Tool Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6 h-12">
            <TabsTrigger value="pingen" className="gap-2 text-sm md:text-base">
              <ImageIcon className="w-4 h-4" />
              PinGen
            </TabsTrigger>
            <TabsTrigger value="videogen" className="gap-2 text-sm md:text-base">
              <Video className="w-4 h-4" />
              VideoGen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pingen" className="mt-0 animate-fade-in">
            <PinGenTool />
          </TabsContent>

          <TabsContent value="videogen" className="mt-0 animate-fade-in">
            <VideoGenTool />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
