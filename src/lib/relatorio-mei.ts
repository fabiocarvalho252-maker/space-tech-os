// Receita bruta mensal para a declaração anual do MEI (DASN-SIMEI), separada
// em comércio (revenda de produtos, peças e aparelhos) e prestação de
// serviços. Pela data da venda e do faturamento da OS (competência), sem
// vendas/faturamentos cancelados. Puro (sem banco) para rodar no node --test.

/** Limite anual de receita bruta do MEI. Confira o valor vigente com o contador. */
export const LIMITE_MEI_ANUAL = 81_000;

export type ItemVendaMei = {
  quantidade: number | string;
  preco_unitario: number | string;
  /** true quando o item é um serviço cadastrado (categoria "Serviço"). */
  servico: boolean;
};
export type VendaMei = {
  created_at: string;
  total: number | string;
  itens: ItemVendaMei[];
};
export type FaturamentoMei = {
  created_at: string;
  valor_total: number | string;
  itens: { tipo: string; quantidade: number | string; preco_unitario: number | string }[];
};
export type MesMei = { mes: number; comercio: number; servicos: number; total: number };

const FUSO = "America/Sao_Paulo";

/** Mês (1–12) e ano no horário de Brasília. */
export function mesAnoBrasilia(iso: string): { mes: number; ano: number } {
  const [ano, mes] = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date(iso))
    .split("-")
    .map(Number);
  return { ano: ano!, mes: mes! };
}

/**
 * Divide `total` entre comércio e serviços na proporção dos itens. Sem itens
 * (ou itens zerados), conta tudo como `semItens`.
 */
function dividir(
  total: number,
  comercioBruto: number,
  servicosBruto: number,
  semItens: "comercio" | "servicos",
): { comercio: number; servicos: number } {
  const bruto = comercioBruto + servicosBruto;
  if (bruto <= 0) {
    return semItens === "comercio"
      ? { comercio: total, servicos: 0 }
      : { comercio: 0, servicos: total };
  }
  const servicos = (total * servicosBruto) / bruto;
  return { comercio: total - servicos, servicos };
}

export function calcularReceitaMei(
  ano: number,
  vendas: VendaMei[],
  faturamentos: FaturamentoMei[],
): MesMei[] {
  const meses: MesMei[] = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    comercio: 0,
    servicos: 0,
    total: 0,
  }));
  function somar(iso: string, parte: { comercio: number; servicos: number }) {
    const { ano: a, mes } = mesAnoBrasilia(iso);
    if (a !== ano) return;
    const m = meses[mes - 1]!;
    m.comercio += parte.comercio;
    m.servicos += parte.servicos;
    m.total += parte.comercio + parte.servicos;
  }

  // Venda: o total já tem o desconto; rateado entre produtos e serviços.
  for (const v of vendas) {
    let comercio = 0;
    let servicos = 0;
    for (const i of v.itens) {
      const bruto = Number(i.quantidade) * Number(i.preco_unitario);
      if (i.servico) servicos += bruto;
      else comercio += bruto;
    }
    somar(v.created_at, dividir(Number(v.total), comercio, servicos, "comercio"));
  }
  // Faturamento de OS: valor faturado rateado entre peças e serviços da OS.
  for (const f of faturamentos) {
    let comercio = 0;
    let servicos = 0;
    for (const i of f.itens) {
      const bruto = Number(i.quantidade) * Number(i.preco_unitario);
      if (i.tipo === "servico") servicos += bruto;
      else comercio += bruto;
    }
    somar(f.created_at, dividir(Number(f.valor_total), comercio, servicos, "servicos"));
  }

  for (const m of meses) {
    m.comercio = Math.round(m.comercio * 100) / 100;
    m.servicos = Math.round(m.servicos * 100) / 100;
    m.total = Math.round((m.comercio + m.servicos) * 100) / 100;
  }
  return meses;
}
