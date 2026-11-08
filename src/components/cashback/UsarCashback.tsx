// "Usar cashback" no PDV e no faturamento da OS: mostra o saldo do cliente
// e, marcado, devolve o valor a abater — limitado ao saldo e ao % máximo
// por compra (Configurações → Empresa → Cashback). Quem grava o uso é a
// função do banco junto com a venda/faturamento (tudo ou nada).
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataBR } from "@/lib/format";

export type ConfigCashback = {
  ativo: boolean;
  percentual: number;
  validade_dias: number;
  uso_max_percentual: number;
};

export function useConfigCashback() {
  return useQuery({
    queryKey: ["cashback-config"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("cashback_config").select("*").maybeSingle();
      return (data ?? null) as ConfigCashback | null;
    },
  });
}

export function useSaldoCashback(clienteId: string | null | undefined, ligado: boolean) {
  return useQuery({
    queryKey: ["cashback-saldo", clienteId],
    enabled: !!clienteId && ligado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cashback_saldo", { p_cliente: clienteId! });
      if (error) throw error;
      return (data ?? null) as { saldo: number; proximo_vencimento: string | null } | null;
    },
  });
}

const centavos = (v: number) => Math.floor(v * 100 + 1e-6) / 100;

/** Valor de cashback a usar, ou 0. `base` = valor da compra antes do cashback. */
export function UsarCashback({
  clienteId,
  base,
  usar,
  onUsarChange,
  onValor,
}: {
  clienteId: string | null | undefined;
  base: number;
  usar: boolean;
  onUsarChange: (v: boolean) => void;
  onValor: (valor: number) => void;
}) {
  const { data: cfg } = useConfigCashback();
  const ligado = !!cfg?.ativo;
  const { data: saldo } = useSaldoCashback(clienteId, ligado);
  const disponivel = Number(saldo?.saldo ?? 0);
  const maximo = centavos(Math.min(disponivel, (base * (cfg?.uso_max_percentual ?? 0)) / 100));
  const valor = usar && maximo > 0 ? maximo : 0;

  useEffect(() => {
    onValor(valor);
  }, [valor, onValor]);

  if (!ligado || !clienteId || disponivel <= 0) return null;

  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={usar}
        disabled={maximo <= 0}
        onChange={(e) => onUsarChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold">
          <Gift className="h-4 w-4 text-amber-500" /> Usar cashback: {brl(maximo)}
        </span>
        <span className="block text-xs text-muted-foreground">
          Saldo do cliente {brl(disponivel)}
          {saldo?.proximo_vencimento
            ? ` · vence a partir de ${dataBR(saldo.proximo_vencimento)}`
            : ""}
          {maximo < disponivel ? ` · até ${cfg?.uso_max_percentual}% da compra` : ""}
        </span>
      </span>
    </label>
  );
}
