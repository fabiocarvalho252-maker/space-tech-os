// Barra de etapas da Nova OS: número + nome de cada etapa, a atual em
// destaque e as já vistas com ✓ (clicáveis para voltar). No celular mostra só
// os números e o nome da etapa atual embaixo.
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type EtapaInfo = { titulo: string; descricao: string };

export function BarraEtapas({
  etapas,
  atual,
  maxVisitada,
  onIr,
}: {
  etapas: EtapaInfo[];
  atual: number;
  maxVisitada: number;
  onIr: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      <ol className="flex items-center">
        {etapas.map((e, i) => {
          const feita = i < atual || (i <= maxVisitada && i !== atual);
          const ativa = i === atual;
          const podeIr = i <= maxVisitada && !ativa;
          return (
            <li key={e.titulo} className={cn("flex items-center", i > 0 && "flex-1")}>
              {i > 0 && (
                <span
                  className={cn(
                    "mx-1.5 h-0.5 flex-1 rounded-full sm:mx-2",
                    i <= maxVisitada ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <button
                type="button"
                disabled={!podeIr}
                onClick={() => onIr(i)}
                className={cn(
                  "flex items-center gap-2 rounded-full text-left",
                  podeIr && "cursor-pointer hover:opacity-80",
                )}
                title={e.titulo}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition",
                    ativa && "border-primary bg-primary text-primary-foreground",
                    !ativa && feita && "border-primary bg-primary/10 text-primary",
                    !ativa && !feita && "border-border text-muted-foreground",
                  )}
                >
                  {feita && !ativa ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-xs font-medium lg:inline",
                    ativa ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {e.titulo}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-sm font-semibold">
          Etapa {atual + 1} de {etapas.length} — {etapas[atual]!.titulo}
        </p>
        <p className="text-xs text-muted-foreground">{etapas[atual]!.descricao}</p>
      </div>
    </div>
  );
}

/** Linha do resumo da revisão: rótulo à esquerda, valor à direita. */
export function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium">{valor || "—"}</span>
    </div>
  );
}

/** Bloco da revisão com título e botão "Alterar" que volta à etapa. */
export function BlocoResumo({
  titulo,
  onAlterar,
  children,
}: {
  titulo: string;
  onAlterar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{titulo}</p>
        <button
          type="button"
          onClick={onAlterar}
          className="text-xs font-medium text-primary hover:underline"
        >
          Alterar
        </button>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}
