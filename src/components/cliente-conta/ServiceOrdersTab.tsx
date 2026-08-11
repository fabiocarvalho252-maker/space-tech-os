import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { dataBR, statusLabel } from "@/lib/format";
import { tonOsStatus } from "./status";
import type { MeuCliente, MinhaOs } from "./types";

const LIMITE = 50;

export function ServiceOrdersTab({
  cliente,
  onAbrirOs,
}: {
  cliente: MeuCliente;
  onAbrirOs: (os: MinhaOs) => void;
}) {
  const { data: ordens, isLoading } = useQuery({
    queryKey: ["minha-conta-todas-os", cliente.id],
    queryFn: async (): Promise<MinhaOs[]> => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return (data ?? []) as unknown as MinhaOs[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!ordens || ordens.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
        Você ainda não possui Ordens de Serviço.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nº</th>
              <th className="px-4 py-3 font-semibold">Responsável</th>
              <th className="px-4 py-3 font-semibold">Data Inicial</th>
              <th className="px-4 py-3 font-semibold">Data Final</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {ordens.map((os) => (
              <tr key={os.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-bold text-slate-900">#{os.numero}</td>
                <td className="px-4 py-3 text-slate-600">{os.responsavel || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{dataBR(os.created_at)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {os.status === "entregue" || os.status === "faturado"
                    ? dataBR(os.updated_at)
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge label={statusLabel(os.status)} tone={tonOsStatus(os.status)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onAbrirOs(os)}
                    className="text-sm font-semibold text-[#2563eb] hover:underline"
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 p-3 md:hidden">
        {ordens.map((os) => (
          <div key={os.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900">#{os.numero}</p>
              <StatusBadge label={statusLabel(os.status)} tone={tonOsStatus(os.status)} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{os.responsavel || "Sem técnico"}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">{dataBR(os.created_at)}</p>
              <button
                type="button"
                onClick={() => onAbrirOs(os)}
                className="text-sm font-semibold text-[#2563eb] hover:underline"
              >
                Detalhes
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
