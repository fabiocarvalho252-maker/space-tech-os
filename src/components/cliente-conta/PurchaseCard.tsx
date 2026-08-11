import { StatusBadge } from "@/components/StatusBadge";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { tonVendaStatus } from "./status";
import type { MinhaVenda } from "./types";

export function PurchaseCard({ venda }: { venda: MinhaVenda }) {
  const descricao =
    venda.itens
      .slice(0, 3)
      .map((i) => i.descricao)
      .join(", ") || "Sem itens";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-bold text-slate-900">Pedido #{venda.numero}</p>
        <p className="text-xs text-slate-500">{dataBR(venda.created_at)}</p>
        <p className="mt-1 truncate text-sm text-slate-600">{descricao}</p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <p className="font-bold text-slate-900">{brl(venda.total)}</p>
        <StatusBadge label={statusLabel(venda.status)} tone={tonVendaStatus(venda.status)} />
      </div>
    </div>
  );
}
