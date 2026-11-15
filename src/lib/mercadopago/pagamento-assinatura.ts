// Chave de ativação do pagamento da assinatura pelo Mercado Pago (Pix e cartão).
// Desligada: a empresa não cria cobrança pelo site e a equipe atende o pedido.
// Para reativar, troque para true e faça o deploy.
export const PAGAMENTO_ASSINATURA_MERCADOPAGO_ATIVO = false;

export const MENSAGEM_PAGAMENTO_INDISPONIVEL =
  "O pagamento online está indisponível no momento. Fale com a equipe para contratar.";

// Lança erro quando o pagamento está desligado. Recebe a chave como parâmetro
// para ser testável; o servidor usa PAGAMENTO_ASSINATURA_MERCADOPAGO_ATIVO.
export function garantirPagamentoAssinaturaAtivo(
  ativo: boolean = PAGAMENTO_ASSINATURA_MERCADOPAGO_ATIVO,
): void {
  if (!ativo) throw new Error(MENSAGEM_PAGAMENTO_INDISPONIVEL);
}

// Link do WhatsApp com o plano escolhido já escrito na mensagem.
export function montarLinkWhatsappPlano(opcoes: {
  base: string;
  nomePlano: string;
  precoMensal: number | null;
}): string {
  const preco =
    opcoes.precoMensal !== null
      ? ` (${opcoes.precoMensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês)`
      : "";
  const mensagem = `Olá! Quero contratar o plano ${opcoes.nomePlano} do SPACE TECH OS${preco}.`;
  return `${opcoes.base}?text=${encodeURIComponent(mensagem)}`;
}
