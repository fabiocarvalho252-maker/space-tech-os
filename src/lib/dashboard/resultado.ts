import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

// Cálculo do "Resultado do mês" (DRE resumido) do Painel, separado da tela
// para o período atual e o anterior usarem exatamente a mesma regra.

export type PeriodoResultado = "hoje" | "semana" | "mes" | "mes_anterior" | "personalizado";

// Itens de OS/venda cancelada (ou OS reprovada) não geraram receita
// nenhuma, então o custo deles também não pode ser descontado do lucro.
const OS_STATUS_SEM_CUSTO = new Set(["cancelado", "reprovado"]);

export type LancamentoResultado = {
  tipo: string;
  valor: number | string;
  data: string;
  status: string | null;
};
export type ItemResultado = {
  produto_id: string | null;
  quantidade: number;
  created_at: string;
  ordens_servico?: { status?: string } | null;
  vendas?: { status?: string } | null;
};
export type ProdutoCusto = { categoria: string | null; preco_custo: number | string | null };

export type Resultado = {
  receita: number;
  despesas: number;
  cmv: number;
  custoServicos: number;
  lucroLiquido: number;
  margem: number;
  /** Custo (CMV + serviços) por dia yyyy-MM-dd, para o gráfico. */
  custoPorDia: Map<string, number>;
};

export function calcularResultado(
  lancamentos: LancamentoResultado[],
  osItens: ItemResultado[],
  vendaItens: ItemResultado[],
  produtosById: Map<string, ProdutoCusto>,
): Resultado {
  // Só lançamentos "pago" contam como caixa realizado — mesmo padrão da tela
  // Financeiro (filtro padrão status="pago"). "pendente" ainda não entrou no
  // caixa e "cancelado" não deve contar como receita/despesa.
  let receita = 0;
  let despesas = 0;
  for (const l of lancamentos) {
    if (l.status !== "pago") continue;
    if (l.tipo === "entrada") receita += Number(l.valor);
    else if (l.tipo === "saida") despesas += Number(l.valor);
  }

  // Custo (CMV): a peça/serviço consumido tem seu custo no próprio cadastro
  // (produtos.preco_custo — "Custo Adicional" na tela de Serviços), esteja
  // ele categorizado como produto físico ou como serviço. O custo dos
  // serviços (categoria "Serviço") fica separado do CMV das peças/produtos
  // — é o mesmo valor que o Financeiro mostra como saída automática
  // "Custo dos serviços".
  let cmv = 0;
  let custoServicos = 0;
  const custoPorDia = new Map<string, number>();
  function somarCusto(produtoId: string | null, quantidade: number, criadoEm: string) {
    const produto = produtoId ? produtosById.get(produtoId) : null;
    if (!produto) return;
    const custo = Number(quantidade) * Number(produto.preco_custo ?? 0);
    if (produto.categoria === "Serviço") custoServicos += custo;
    else cmv += custo;
    const dia = format(new Date(criadoEm), "yyyy-MM-dd");
    custoPorDia.set(dia, (custoPorDia.get(dia) ?? 0) + custo);
  }
  for (const i of osItens) {
    const statusOs = i.ordens_servico?.status;
    if (statusOs && OS_STATUS_SEM_CUSTO.has(statusOs)) continue;
    somarCusto(i.produto_id, i.quantidade, i.created_at);
  }
  for (const i of vendaItens) {
    if (i.vendas?.status === "cancelado") continue;
    somarCusto(i.produto_id, i.quantidade, i.created_at);
  }

  const lucroLiquido = receita - cmv - custoServicos - despesas;
  const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;
  return { receita, despesas, cmv, custoServicos, lucroLiquido, margem, custoPorDia };
}

/**
 * Período equivalente imediatamente anterior, para comparação:
 * "Este mês" (dia 1 até hoje) compara com os mesmos dias do mês passado;
 * "Mês anterior" com o mês antes dele; "Hoje" com ontem; "Esta semana" com a
 * semana passada; "Personalizado" com o mesmo número de dias logo antes.
 */
export function intervaloAnterior(
  periodo: PeriodoResultado,
  inicio: Date,
  fim: Date,
): { inicio: Date; fim: Date } {
  switch (periodo) {
    case "hoje":
      return { inicio: subDays(inicio, 1), fim: subDays(fim, 1) };
    case "semana":
      return { inicio: subWeeks(inicio, 1), fim: subWeeks(fim, 1) };
    case "mes":
      return { inicio: subMonths(inicio, 1), fim: subMonths(fim, 1) };
    case "mes_anterior": {
      const mes = subMonths(inicio, 1);
      return { inicio: startOfMonth(mes), fim: endOfMonth(mes) };
    }
    case "personalizado":
    default: {
      const dias = Math.max(differenceInCalendarDays(fim, inicio), 0) + 1;
      return { inicio: subDays(inicio, dias), fim: subDays(inicio, 1) };
    }
  }
}

/** Variação percentual de `atual` sobre `anterior`; null quando não há base (anterior = 0). */
export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}
