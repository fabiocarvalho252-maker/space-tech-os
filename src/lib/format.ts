export const brl = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

// A bare "YYYY-MM-DD" (Postgres `date` columns, with no time component) is
// parsed by `new Date()` as UTC midnight — in any timezone behind UTC
// (all of Brazil), toLocaleDateString() then rolls it back to the previous
// day. Parsing the components as a local date sidesteps that; full
// timestamps (with time/offset) go through the normal UTC-instant parse.
export const dataBR = (value: string | null | undefined) => {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const [, ano, mes, dia] = match;
    return new Date(Number(ano), Number(mes) - 1, Number(dia)).toLocaleDateString("pt-BR");
  }
  return new Date(value).toLocaleDateString("pt-BR");
};

// Money math (splitting totals across installments, comparing sums) is done
// in integer centavos to avoid float rounding drift like 33.33+33.33+33.34
// landing a cent off from the total — only converting back to reais (the
// unit the DB and inputs use) at the boundary.
export const paraCentavos = (reais: number) => Math.round((Number(reais) || 0) * 100);
export const paraReais = (centavos: number) => centavos / 100;

export const STATUS_OS = [
  { value: "recebido", label: "Recebido" },
  { value: "em_analise", label: "Em análise" },
  { value: "orcamento", label: "Orçamento" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_reparo", label: "Em reparo" },
  { value: "aguardando_peca", label: "Aguardando peça" },
  { value: "pronto", label: "Pronto" },
  { value: "entregue", label: "Entregue" },
  { value: "faturado", label: "Faturado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const STATUS_VENDAS = [
  { value: "aberto", label: "Aberto" },
  { value: "orcamento", label: "Orçamento" },
  { value: "negociacao", label: "Negociação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "aguardando_pecas", label: "Aguardando Peças" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "finalizado", label: "Finalizado" },
  { value: "faturado", label: "Faturado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const STATUS_COMPRAS = [
  { value: "aberto", label: "Aberto" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "recebido", label: "Recebido" },
  { value: "finalizado", label: "Finalizado" },
  { value: "faturado", label: "Faturado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const STATUS_APARELHOS = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
  { value: "devolvido", label: "Devolvido" },
  { value: "garantia", label: "Em garantia" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export const statusLabel = (value: string) =>
  STATUS_OS.find((s) => s.value === value)?.label ??
  STATUS_VENDAS.find((s) => s.value === value)?.label ??
  STATUS_COMPRAS.find((s) => s.value === value)?.label ??
  STATUS_APARELHOS.find((s) => s.value === value)?.label ??
  value;

// One distinct color per status of Ordem de Serviço, so a técnico scanning
// the list can tell "aguardando peça" from "em reparo" from "pronto" at a
// glance instead of reading every label. Written out as full literal
// classNames (not built with template interpolation) because Tailwind's JIT
// scanner only picks up class names it can find as-is in source.
export const STATUS_OS_COR: Record<(typeof STATUS_OS)[number]["value"], string> = {
  recebido: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  em_analise: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  orcamento: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  aguardando_aprovacao: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  aprovado: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  em_reparo: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  aguardando_peca: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  pronto: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  entregue: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  faturado: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  reprovado: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  cancelado: "bg-red-500/10 text-red-600 border-red-500/20",
};
