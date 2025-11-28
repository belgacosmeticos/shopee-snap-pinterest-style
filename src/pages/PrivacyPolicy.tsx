import { Helmet } from "react-helmet-async";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  return (
    <>
      <Helmet>
        <title>Política de Privacidade | Lovable Autopost</title>
        <meta name="description" content="Política de Privacidade do Lovable Autopost - Gerador de Pins para Pinterest" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <Link to="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>
          
          <article className="prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
            <p className="text-muted-foreground mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
            
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">1. Introdução</h2>
              <p className="text-muted-foreground leading-relaxed">
                Esta Política de Privacidade descreve como o <strong>Lovable Autopost</strong> ("nós", "nosso" ou "aplicativo") 
                coleta, usa e protege as informações dos usuários. Ao utilizar nosso serviço, você concorda com as práticas 
                descritas nesta política.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">2. Dados Coletados</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Coletamos os seguintes tipos de informações:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Links de produtos:</strong> URLs de produtos da Shopee fornecidos por você para geração de conteúdo</li>
                <li><strong>Imagens de produtos:</strong> Imagens públicas dos produtos para criação de Pins</li>
                <li><strong>Dados de autenticação Pinterest:</strong> Tokens de acesso OAuth para publicação automática (quando autorizado)</li>
                <li><strong>Dados de uso:</strong> Informações sobre como você interage com o aplicativo</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Como Usamos os Dados</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Utilizamos as informações coletadas para:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Gerar títulos e descrições otimizadas para Pinterest usando inteligência artificial</li>
                <li>Criar imagens personalizadas para seus Pins</li>
                <li>Publicar conteúdo em sua conta do Pinterest (quando autorizado)</li>
                <li>Melhorar nossos serviços e experiência do usuário</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Integrações com Terceiros</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Nosso aplicativo integra-se com os seguintes serviços:</p>
              
              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Pinterest API</h3>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos a API do Pinterest para permitir a publicação automática de Pins em sua conta. 
                O acesso é concedido através de autenticação OAuth 2.0, e você pode revogar o acesso a qualquer momento 
                através das configurações de sua conta Pinterest.
              </p>
              
              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">Shopee API</h3>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos a API de Afiliados da Shopee para extrair informações públicas de produtos 
                e gerar links de afiliado. Não acessamos dados pessoais de sua conta Shopee.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Cookies e Tecnologias de Rastreamento</h2>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos cookies e tecnologias similares para manter sua sessão ativa e melhorar a experiência de uso. 
                Você pode configurar seu navegador para recusar cookies, mas isso pode afetar algumas funcionalidades do aplicativo.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">6. Segurança dos Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações contra 
                acesso não autorizado, alteração, divulgação ou destruição. Isso inclui criptografia de dados em trânsito 
                e armazenamento seguro de credenciais.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">7. Seus Direitos (LGPD)</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem os seguintes direitos:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Confirmação da existência de tratamento de dados</li>
                <li>Acesso aos dados pessoais</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
                <li>Portabilidade dos dados</li>
                <li>Eliminação dos dados pessoais tratados com consentimento</li>
                <li>Revogação do consentimento</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">8. Retenção de Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Mantemos seus dados apenas pelo tempo necessário para fornecer nossos serviços. 
                Dados de sessão são excluídos automaticamente após o encerramento. Você pode solicitar 
                a exclusão de seus dados a qualquer momento entrando em contato conosco.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">9. Alterações nesta Política</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações 
                significativas através do aplicativo ou por e-mail. Recomendamos que você revise esta página 
                regularmente para se manter informado sobre nossas práticas de privacidade.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">10. Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos seus dados, 
                entre em contato conosco:
              </p>
              <p className="text-muted-foreground mt-4">
                <strong>E-mail:</strong>{" "}
                <a href="mailto:contato@lovableautopost.com" className="text-primary hover:underline">
                  contato@lovableautopost.com
                </a>
              </p>
            </section>
          </article>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicy;
