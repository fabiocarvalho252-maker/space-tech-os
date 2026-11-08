// Área do Cliente: "Você tem R$ X de cashback" — saldo do cliente da OS do
// link (cashback_publico; só aparece com o cashback da loja ligado e saldo).
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataBR } from "@/lib/format";

export function CashbackCliente({ osId }: { osId: string }) {
  const { data } = useQuery({
    queryKey: ["cashback-publico", osId],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashback_publico", { p_identificador: osId });
      if (error) throw error;
      return (data ?? null) as { saldo: number; proximo_vencimento: string | null } | null;
    },
  });
  if (!data) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
      <Gift className="h-5 w-5 shrink-0 text-amber-500" />
      <p>
        Você tem <strong>{brl(data.saldo)}</strong> de cashback para usar na próxima visita
        {data.proximo_vencimento ? ` (vence a partir de ${dataBR(data.proximo_vencimento)})` : ""}.
      </p>
    </div>
  );
}
