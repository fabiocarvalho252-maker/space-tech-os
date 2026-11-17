import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { carregarEventos, listarMissoes } from "../api/historico.ts";
import type { EventoEscritorio } from "../tipos.ts";

const ROTULO: Record<string, string> = {
  fila: "Na fila",
  rodando: "Rodando",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

type Props = { onMostrar: (eventos: EventoEscritorio[], resultado: string | null) => void };

export function MissionHistory({ onMostrar }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["office-missions"],
    queryFn: () => listarMissoes(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  if (error)
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Erro ao carregar."}
      </p>
    );
  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma missão ainda.</p>;
  }

  const abrir = async (id: string) => {
    const eventos = await carregarEventos(id);
    const missao = data?.find((m) => m.id === id);
    onMostrar(eventos, missao?.result_markdown ?? null);
  };

  return (
    <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
      {data.map((m) => (
        <li key={m.id} className="rounded-xl border border-border bg-card/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{ROTULO[m.status] ?? m.status}</span>
            <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleString("pt-BR")}</time>
          </div>
          <p className="mt-1 line-clamp-2">{m.prompt}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              US$ {Number(m.cost_usd).toFixed(2)}
            </span>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void abrir(m.id)}>
              <History className="h-4 w-4" /> Reproduzir
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
