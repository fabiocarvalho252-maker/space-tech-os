export const brl = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0),
  );

export const dataBR = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";

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

export const statusLabel = (value: string) =>
  STATUS_OS.find((s) => s.value === value)?.label ?? 
  STATUS_VENDAS.find((s) => s.value === value)?.label ?? 
  STATUS_COMPRAS.find((s) => s.value === value)?.label ?? 
  value;
