import { StatusBadge } from "@/components/StatusBadge";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { tonOsStatus } from "./status";
import type { MinhaOs } from "./types";

export function ServiceOrderCard({ os, onDetalhes }: { os: MinhaOs; onDetalhes: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-bold text-slate-900">OS #{os.numero}</p>
        <p className="truncate text-sm text-slate-600">
          {os.aparelho} {os.marca ? `— ${os.marca}` : ""} {os.modelo ?? ""}
        </p>
        <p className="text-xs text-slate-500">{dataBR(os.created_at)}</p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <p className="font-bold text-slate-900">{brl(os.valor)}</p>
        <StatusBadge label={statusLabel(os.status)} tone={tonOsStatus(os.status)} />
        <button
          type="button"
          onClick={onDetalhes}
          className="text-sm font-semibold text-[#2563eb] hover:underline"
        >
          Ver detalhes
        </button>
      </div>
    </div>
  );
}
