// Sugestão de previsão de entrega na OS: pelo tempo que a loja costuma levar
// (previsao_sugerida — percentil 75 das OS dos últimos 180 dias, pelos
// serviços da OS quando há histórico deles). Mostra a data e "Usar".
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { dataBR } from "@/lib/format";

type Sugestao = { horas: number; dias: number; amostra: number; base: "servicos" | "loja" };

function textoTempo(horas: number) {
  if (horas < 1) return "menos de 1 h";
  if (horas < 24) return `~${Math.ceil(horas)} h`;
  const d = Math.ceil(horas / 24);
  return `~${d} dia${d > 1 ? "s" : ""}`;
}

export function SugestaoPrevisao({
  produtos,
  atual,
  onUsar,
}: {
  produtos: string[];
  atual: string;
  onUsar: (data: string) => void;
}) {
  const chave = [...new Set(produtos)].sort();
  const { data } = useQuery({
    queryKey: ["previsao-sugerida", chave],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("previsao_sugerida", {
        p_produtos: chave.length ? chave : null,
      });
      if (error) throw error;
      return (data ?? null) as Sugestao | null;
    },
  });
  if (!data) return null;

  // Domingo não conta: passa para segunda.
  let alvo = addDays(new Date(), data.dias);
  if (alvo.getDay() === 0) alvo = addDays(alvo, 1);
  const iso = format(alvo, "yyyy-MM-dd");
  const rotulo = iso === format(new Date(), "yyyy-MM-dd") ? "hoje" : dataBR(iso);

  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <Sparkles className="h-3 w-3 text-primary" />
      Sugestão: <strong className="text-foreground">{rotulo}</strong>
      <span>
        (75% {data.base === "servicos" ? "das OS com esses serviços" : "das OS da loja"} ficam
        prontas em {textoTempo(Number(data.horas))})
      </span>
      {atual !== iso && (
        <button
          type="button"
          onClick={() => onUsar(iso)}
          className="font-semibold text-primary hover:underline"
        >
          Usar
        </button>
      )}
    </p>
  );
}
