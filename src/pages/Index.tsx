import { ToolsDashboard } from '@/components/ToolsDashboard';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Shopee Tools - Gerador de Pins e Vídeos Virais | Afiliados</title>
        <meta name="description" content="Ferramentas para criadores de conteúdo afiliados Shopee. Gere pins virais e extraia vídeos com legendas automáticas." />
      </Helmet>
      <ToolsDashboard />
    </>
  );
};

export default Index;
