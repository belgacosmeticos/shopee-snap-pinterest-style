import { ToolsDashboard } from '@/components/ToolsDashboard';
import { PinAuth } from '@/components/PinAuth';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Content Tools - Gerador de Pins, Vídeos e Sora | Criadores</title>
        <meta name="description" content="Ferramentas para criadores de conteúdo. Gere pins virais, extraia vídeos Shopee e baixe vídeos do Sora 2.0." />
      </Helmet>
      <PinAuth>
        <ToolsDashboard />
      </PinAuth>
    </>
  );
};

export default Index;
