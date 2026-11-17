// Selos de status dos conteúdos de marketing. Única fonte das cores de status:
// âmbar = aguardando, esmeralda = aprovado, azul = publicado, zinc = rascunho.
import { CheckCircle2, Clock, PenLine, Send } from "lucide-react";
import type { StatusMarketing } from "@/lib/marketing/conteudo";
import { cn } from "@/lib/utils";

export const ESTILO_STATUS: Record<
  StatusMarketing,
  { rotulo: string; classe: string; icone: typeof Clock }
> = {
  "AGUARDANDO APROVAÇÃO": {
    rotulo: "Aguardando aprovação",
    classe: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icone: Clock,
  },
  APROVADO: {
    rotulo: "Aprovado",
    classe: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icone: CheckCircle2,
  },
  PUBLICADO: {
    rotulo: "Publicado",
    classe: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    icone: Send,
  },
  RASCUNHO: {
    rotulo: "Rascunho",
    classe: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    icone: PenLine,
  },
};

export function SeloStatus({ status }: { status: StatusMarketing | null }) {
  if (!status) return <span className="text-xs text-destructive">Status inválido</span>;
  const e = ESTILO_STATUS[status];
  const Icone = e.icone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        e.classe,
      )}
    >
      <Icone className="h-3 w-3" /> {e.rotulo}
    </span>
  );
}
