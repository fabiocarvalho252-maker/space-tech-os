import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History, Inbox } from "lucide-react";
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
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["office-missions"],
    queryFn: () => listarMissoes(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando histórico…</p>;
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="font-medium">Não foi possível carregar o histórico</p>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Erro desconhecido."}
        </p>
        <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? "Tentando…" : "Tentar novamente"}
        </Button>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">Nenhuma missão ainda</p>
        <p className="text-sm text-muted-foreground">
          Cada missão executada fica registrada aqui, com status, custo e o resultado final.
        </p>
        <p className="text-xs text-muted-foreground">
          Ação sugerida: envie um pedido no chat para criar a primeira missão.
        </p>
      </div>
    );
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
