import type { EstadoMissao } from "../estado.ts";
import type { StatusMissao } from "../tipos.ts";
import { cn } from "@/lib/utils";

const ROTULO_STATUS: Record<StatusMissao, string> = {
  ocioso: "Sem missão",
  rodando: "Em andamento",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

const COR_STATUS: Record<StatusMissao, string> = {
  ocioso: "border-border text-muted-foreground",
  rodando: "border-primary/40 bg-primary/15 text-primary",
  concluida: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  falhou: "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-300",
  cancelada: "border-zinc-500/40 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

export function OfficeToolbar({ estado }: { estado: EstadoMissao }) {
  const ativos = estado.ordem.filter((id) => estado.agentes[id]?.estado !== "ocioso").length;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className={cn("rounded-full border px-3 py-1 font-semibold", COR_STATUS[estado.status])}
      >
        {ROTULO_STATUS[estado.status]}
      </span>
      <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
        {ativos} agente(s) ativo(s)
      </span>
    </div>
  );
}
