import type { StatusTone } from "@/components/StatusBadge";

// Tone mapping for the real status values this app actually uses (see
// STATUS_OS/STATUS_VENDAS in src/lib/format.ts) — never invents new
// statuses, just colors the existing ones sensibly.
const TONS_OS: Record<string, StatusTone> = {
  recebido: "info",
  em_analise: "info",
  orcamento: "warning",
  aguardando_aprovacao: "warning",
  aprovado: "info",
  em_reparo: "info",
  aguardando_peca: "warning",
  pronto: "success",
  entregue: "success",
  faturado: "success",
  reprovado: "danger",
  cancelado: "danger",
};

const TONS_VENDA: Record<string, StatusTone> = {
  aberto: "neutral",
  orcamento: "warning",
  negociacao: "warning",
  aprovado: "info",
  aguardando_pecas: "warning",
  em_andamento: "info",
  finalizado: "success",
  faturado: "success",
  cancelado: "danger",
};

export function tonOsStatus(status: string): StatusTone {
  return TONS_OS[status] ?? "neutral";
}

export function tonVendaStatus(status: string): StatusTone {
  return TONS_VENDA[status] ?? "neutral";
}
