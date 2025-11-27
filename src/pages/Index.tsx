import { PinGenTool } from '@/components/PinGenTool';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>PinGen - Gerador de Pins Virais para Pinterest | Afiliados Shopee</title>
        <meta name="description" content="Transforme produtos da Shopee em imagens virais para o Pinterest. Ferramenta de geração de conteúdo para afiliados." />
      </Helmet>
      <PinGenTool />
    </>
  );
};

export default Index;
