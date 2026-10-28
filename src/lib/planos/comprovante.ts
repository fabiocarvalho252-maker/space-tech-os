// Comprovante de pagamento do plano SPACE TECH (renovação por Pix ou cartão).
// Client-safe: o mesmo texto vai pelo WhatsApp para a empresa (servidor) e
// aparece na tela de Meu Plano (/assinatura) para imprimir.

export type DadosComprovante = {
  loja: string;
  plano: string;
  ciclo: "monthly" | "yearly";
  metodo: "pix" | "credit_card";
  valor: number;
  pagoEm: string;
  /** Último dia de acesso depois do pagamento ("AAAA-MM-DD"), se tiver vencimento. */
  acessoAte: string | null;
  /** Id do pagamento no Mercado Pago (autenticação do comprovante). */
  codigo: string | null;
};

function reais(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataCurtaBR(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function dataHoraBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Linhas "rótulo: valor" do comprovante, na ordem de exibição. */
export function linhasComprovante(d: DadosComprovante): [string, string][] {
  return [
    ["Empresa", d.loja],
    ["Plano", `${d.plano} (${d.ciclo === "yearly" ? "anual" : "mensal"})`],
    ["Valor pago", reais(d.valor)],
    ["Forma de pagamento", d.metodo === "pix" ? "Pix" : "Cartão de crédito"],
    ["Pago em", dataHoraBR(d.pagoEm)],
    ...(d.acessoAte ? [["Acesso liberado até", dataCurtaBR(d.acessoAte)] as [string, string]] : []),
    ...(d.codigo ? [["Código do pagamento", d.codigo] as [string, string]] : []),
  ];
}

/** Texto do comprovante para o WhatsApp da empresa. */
export function textoComprovanteWhatsapp(d: DadosComprovante): string {
  return [
    "✅ *Pagamento confirmado — SPACE TECH*",
    "",
    ...linhasComprovante(d).map(([rotulo, valor]) => `*${rotulo}:* ${valor}`),
    "",
    "Obrigado pela confiança! Seu acesso já está renovado. 🚀",
  ].join("\n");
}
