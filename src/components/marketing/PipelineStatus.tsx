// Visão geral do funil de conteúdos: uma barra segmentada com a proporção de
// cada status e atalhos para filtrar a lista. Substitui a grade de quatro
// cartões iguais. O destaque "aguardando" aparece só quando há algo para decidir.
import { ArrowRight } from "lucide-react";
import type { StatusMarketing } from "@/lib/marketing/conteudo";
import { ESTILO_STATUS } from "./SeloStatus";
import { cn } from "@/lib/utils";

const ORDEM: StatusMarketing[] = ["AGUARDANDO APROVAÇÃO", "APROVADO", "PUBLICADO", "RASCUNHO"];

const COR_BARRA: Record<StatusMarketing, string> = {
  "AGUARDANDO APROVAÇÃO": "bg-amber-500",
  APROVADO: "bg-emerald-500",
  PUBLICADO: "bg-sky-500",
  RASCUNHO: "bg-zinc-500",
};

type Props = {
  total: number;
  contagem: (status: StatusMarketing) => number;
  onEscolher: (status: StatusMarketing) => void;
};

function percentual(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

export function PipelineStatus({ total, contagem, onEscolher }: Props) {
  const aguardando = contagem("AGUARDANDO APROVAÇÃO");

  return (
    <div className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Funil de conteúdos · {total} no total
        </h2>
        {aguardando > 0 && (
          <button
            type="button"
            onClick={() => onEscolher("AGUARDANDO APROVAÇÃO")}
            className="inline-flex items-center gap-1 text-sm font-semibold text-amber-600 transition hover:underline dark:text-amber-300"
          >
            {aguardando} {aguardando === 1 ? "espera" : "esperam"} sua decisão
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        role="img"
        aria-label={ORDEM.map((s) => `${ESTILO_STATUS[s].rotulo}: ${contagem(s)}`).join(", ")}
        className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        {ORDEM.map((s) => {
          const n = contagem(s);
          if (n === 0) return null;
          return (
            <span
              key={s}
              className={cn("h-full transition-all duration-500", COR_BARRA[s])}
              style={{ width: `${percentual(n, total)}%` }}
            />
          );
        })}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ORDEM.map((s) => {
          const e = ESTILO_STATUS[s];
          const Icone = e.icone;
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => onEscolher(s)}
                className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-muted/40 p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-md"
              >
                <span className={cn("inline-flex rounded-lg border p-1.5", e.classe)}>
                  <Icone className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xl font-extrabold leading-none">{contagem(s)}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {e.rotulo}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
