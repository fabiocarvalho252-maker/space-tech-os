import { createFileRoute } from "@tanstack/react-router";
import {
  CONTATO_WHATSAPP,
  CONTATO_WHATSAPP_LINK,
  PaginaLegal,
  RESPONSAVEL,
} from "@/components/PaginaLegal";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [{ title: "Política de Privacidade — SPACE TECH OS" }],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade" atualizadoEm="25/10/2026">
      <p>
        Esta política explica como o SPACE TECH OS (“sistema”, “nós”), sistema de gestão para
        assistências técnicas disponível em srmpretech.online, trata os dados das empresas que o
        utilizam e dos clientes cadastrados por elas, de acordo com a Lei Geral de Proteção de Dados
        (Lei 13.709/2018 — LGPD).
      </p>

      <h2>1. Quem é quem</h2>
      <p>
        A empresa que assina o sistema (assistência técnica, loja) é a controladora dos dados dos
        seus próprios clientes. O SPACE TECH OS atua como operador: armazena e processa esses dados
        apenas para prestar o serviço contratado.
      </p>
      <p>
        O SPACE TECH OS é mantido por <strong>{RESPONSAVEL}</strong>, responsável pelos dados das
        contas das empresas e pelo atendimento sobre esta política.
      </p>

      <h2>2. Dados que tratamos</h2>
      <ul>
        <li>
          Da conta da empresa: nome, nome da loja, e-mail, WhatsApp, CPF/CNPJ, endereço e logotipo.
        </li>
        <li>
          Cadastrados pela empresa no uso do sistema: clientes, fornecedores, aparelhos, ordens de
          serviço, fotos, vendas, estoque, compras, garantias e lançamentos financeiros.
        </li>
        <li>Dados técnicos de acesso: data e hora de login, endereço IP e navegador.</li>
      </ul>

      <h2>3. Para que usamos</h2>
      <ul>
        <li>Prestar as funções do sistema contratadas pela empresa.</li>
        <li>Autenticar o acesso e proteger a conta.</li>
        <li>Enviar avisos sobre a conta, o plano e o funcionamento do sistema.</li>
        <li>Cobrar a assinatura e cumprir obrigações legais.</li>
      </ul>
      <p>Não vendemos dados e não os usamos para publicidade.</p>

      <h2>4. Com quem compartilhamos</h2>
      <p>Somente quando necessário para o funcionamento do serviço:</p>
      <ul>
        <li>Mercado Pago, para pagamentos e cobranças.</li>
        <li>WhatsApp, para as mensagens que a empresa decide enviar aos seus clientes.</li>
        <li>
          Provedores de inteligência artificial, apenas com o texto enviado nas funções de IA (por
          exemplo, descrição do defeito para sugerir um diagnóstico).
        </li>
        <li>Autoridades, quando exigido por lei.</li>
      </ul>

      <h2>5. Google Drive (backup)</h2>
      <p>
        A empresa pode, se quiser, conectar a própria conta Google para guardar backups no Google
        Drive. Nesse caso:
      </p>
      <ul>
        <li>
          Pedimos apenas a permissão <strong>drive.file</strong>, que dá acesso somente às pastas e
          arquivos criados pelo próprio SPACE TECH OS. Não lemos, listamos nem alteramos nenhum
          outro arquivo do seu Drive.
        </li>
        <li>Usamos o seu e-mail Google apenas para mostrar qual conta está conectada.</li>
        <li>
          O acesso é usado exclusivamente para enviar os arquivos de backup da sua empresa e apagar
          backups antigos que o próprio sistema criou.
        </li>
        <li>
          Dados obtidos das APIs do Google não são compartilhados com terceiros, não são usados para
          publicidade nem para treinar modelos de inteligência artificial, e não são lidos por
          pessoas, salvo com o seu consentimento ou quando exigido por lei.
        </li>
        <li>
          Você pode desconectar a qualquer momento em Configurações → Backup ou em
          myaccount.google.com/permissions. Ao desconectar, apagamos a autorização guardada.
        </li>
      </ul>
      <p>
        O uso e a transferência de informações recebidas das APIs do Google seguem a{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="text-primary underline"
          target="_blank"
          rel="noreferrer"
        >
          Política de Dados do Usuário dos Serviços de API do Google
        </a>
        , incluindo os requisitos de Uso Limitado.
      </p>

      <h2>6. Armazenamento e segurança</h2>
      <p>
        Os dados ficam em servidor próprio, com acesso protegido por senha, conexão criptografada
        (HTTPS) e separação entre empresas: cada empresa só acessa os próprios dados. Fazemos cópias
        de segurança diárias.
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <p>
        Enquanto a conta estiver ativa. Se o acesso terminar e a empresa não renovar, a conta e
        todos os dados são apagados após aviso prévio pelo WhatsApp. As cópias de segurança são
        descartadas automaticamente em até 14 dias.
      </p>

      <h2>8. Seus direitos</h2>
      <p>
        Você pode pedir acesso, correção, exportação ou exclusão dos seus dados, e revogar
        consentimentos. Clientes de uma assistência técnica devem fazer o pedido diretamente à
        empresa que os atendeu.
      </p>

      <h2>9. Contato</h2>
      <p>
        Dúvidas sobre esta política ou sobre seus dados: {RESPONSAVEL}, pelo WhatsApp{" "}
        <a href={CONTATO_WHATSAPP_LINK} className="text-primary underline">
          {CONTATO_WHATSAPP}
        </a>
        .
      </p>
    </PaginaLegal>
  );
}
