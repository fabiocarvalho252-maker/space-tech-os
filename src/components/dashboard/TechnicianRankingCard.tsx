// Painel: técnicos no mês atual — produção (OS faturadas, pelo mesmo
// relatorio_tecnicos de Relatórios) ao lado da nota média que os clientes
// deram pela Área do Cliente (os_avaliacoes, pela data da avaliação).
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { endOfMonth, startOfMonth } from "date-fns";
import { Star, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";

type Linha = {
  nome: string;
  qtdOs: number;
  faturamento: number;
  media: number | null;
  avaliacoes: number;
};

export function TechnicianRankingCard() {
  const empresaId = useEmpresaId();
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const inicio = startOfMonth(new Date()).toISOString();
  const fim = endOfMonth(new Date()).toISOString();

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["dashboard-tecnicos-mes", empresaId, inicio],
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Linha[]> => {
      const [producao, avaliacoes] = await Promise.all([
        supabase.rpc("relatorio_tecnicos", {
          p_empresa_id: empresaId!,
          p_inicio: inicio,
          p_fim: fim,
        }),
        supabase
          .from("os_avaliacoes")
          .select("nota, ordens_servico(responsavel)")
          .gte("created_at", inicio)
          .lte("created_at", fim),
      ]);
      if (producao.error) throw producao.error;
      const mapa = new Map<string, Linha>();
      const linha = (nome: string) => {
        const chave = nome.trim() || "Sem técnico";
        let l = mapa.get(chave);
        if (!l) {
          l = { nome: chave, qtdOs: 0, faturamento: 0, media: null, avaliacoes: 0 };
          mapa.set(chave, l);
        }
        return l;
      };
      for (const t of (producao.data ?? []) as unknown as {
        tecnico: string;
        qtd_os: number;
        faturamento: number;
      }[]) {
        const l = linha(t.tecnico ?? "");
        l.qtdOs += Number(t.qtd_os) || 0;
        l.faturamento += Number(t.faturamento) || 0;
      }
      const somas = new Map<string, number>();
      for (const a of (avaliacoes.data ?? []) as unknown as {
        nota: number;
        ordens_servico: { responsavel: string | null } | null;
      }[]) {
        const l = linha(a.ordens_servico?.responsavel ?? "");
        l.avaliacoes++;
        somas.set(l.nome, (somas.get(l.nome) ?? 0) + a.nota);
      }
      for (const l of mapa.values()) {
        if (l.avaliacoes) l.media = somas.get(l.nome)! / l.avaliacoes;
      }
      return [...mapa.values()].sort(
        (a, b) => b.qtdOs - a.qtdOs || (b.media ?? 0) - (a.media ?? 0),
      );
    },
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold sm:text-base">
          <Wrench className="h-4 w-4 text-primary" /> Técnicos do mês
        </h2>
        <Link
          to="/relatorios"
          hash="avaliacoes"
          className="text-xs font-medium text-primary hover:underline"
        >
          Avaliações
        </Link>
      </div>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-secondary/40" />
      ) : linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma OS faturada neste mês ainda.</p>
      ) : (
        <ol className="space-y-2">
          {linhas.map((l, i) => (
            <li key={l.nome} className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
              <span className="w-5 shrink-0 text-center text-sm font-extrabold text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {l.qtdOs} OS · {brl(l.faturamento)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {l.media !== null ? (
                  <>
                    <p className="flex items-center justify-end gap-1 text-sm font-bold">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {l.media.toFixed(1).replace(".", ",")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {l.avaliacoes} avaliaç{l.avaliacoes > 1 ? "ões" : "ão"}
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">sem avaliação</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
