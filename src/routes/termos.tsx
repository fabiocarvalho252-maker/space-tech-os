import { createFileRoute, Link } from "@tanstack/react-router";
import { CONTATO_WHATSAPP, CONTATO_WHATSAPP_LINK, PaginaLegal } from "@/components/PaginaLegal";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [{ title: "Termos de Uso — SPACE TECH OS" }],
  }),
  component: Termos,
});

function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso" atualizadoEm="25/10/2026">
      <p>
        Estes termos regulam o uso do SPACE TECH OS, sistema online de gestão para assistências
        técnicas disponível em srmpretech.online. Ao criar uma conta ou usar o sistema, você
        concorda com eles.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O SPACE TECH OS oferece ordens de serviço, clientes, estoque, vendas, PDV, financeiro,
        agenda, garantias, relatórios e integrações opcionais (WhatsApp, Mercado Pago, inteligência
        artificial e backup no Google Drive). As funções disponíveis dependem do plano contratado.
      </p>

      <h2>2. Conta e acesso</h2>
      <ul>
        <li>As informações de cadastro devem ser verdadeiras e atualizadas.</li>
        <li>
          Você é responsável pela senha e por todas as ações feitas na sua conta e pelos
          funcionários que convidar.
        </li>
        <li>Avise-nos imediatamente se suspeitar de acesso indevido.</li>
      </ul>

      <h2>3. Planos e pagamento</h2>
      <p>
        Após o período de teste, o uso depende de um plano pago. Sem pagamento, o acesso é suspenso.
        Se o acesso ficar encerrado por longo período, a conta pode ser excluída após aviso prévio,
        conforme a{" "}
        <Link to="/privacidade" className="text-primary underline">
          Política de Privacidade
        </Link>
        .
      </p>

      <h2>4. Uso permitido</h2>
      <p>Não é permitido usar o sistema para:</p>
      <ul>
        <li>atividades ilegais ou fraudulentas;</li>
        <li>enviar mensagens em massa não solicitadas (spam) pelo WhatsApp;</li>
        <li>tentar acessar dados de outras empresas ou burlar a segurança do sistema.</li>
      </ul>

      <h2>5. Seus dados</h2>
      <p>
        Os dados cadastrados pertencem à sua empresa. Você é responsável por ter base legal para
        cadastrar os dados dos seus clientes. Você pode exportar seus dados e fazer backup no seu
        próprio Google Drive a qualquer momento.
      </p>

      <h2>6. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o sistema disponível e fazemos backups diários, mas podem ocorrer
        interrupções para manutenção ou por falhas de terceiros (internet, WhatsApp, provedores).
        Recomendamos manter o backup no Google Drive ativado.
      </p>

      <h2>7. Responsabilidade</h2>
      <p>
        O sistema é uma ferramenta de apoio à gestão. Sugestões geradas por inteligência artificial
        devem ser conferidas por um técnico. Não nos responsabilizamos por decisões tomadas com base
        nelas nem por lucros cessantes.
      </p>

      <h2>8. Alterações</h2>
      <p>
        Estes termos podem ser atualizados. Mudanças importantes serão avisadas no sistema ou pelo
        WhatsApp.
      </p>

      <h2>9. Contato</h2>
      <p>
        WhatsApp{" "}
        <a href={CONTATO_WHATSAPP_LINK} className="text-primary underline">
          {CONTATO_WHATSAPP}
        </a>
        .
      </p>
    </PaginaLegal>
  );
}
