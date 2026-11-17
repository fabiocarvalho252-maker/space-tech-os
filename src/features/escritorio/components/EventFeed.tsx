import type { EventoEscritorio } from "../tipos.ts";

const ROTULO_TIPO: Record<EventoEscritorio["tipo"], string> = {
  "missao.criada": "Missão criada",
  "missao.iniciada": "Missão iniciada",
  "missao.concluida": "Missão concluída",
  "missao.falhou": "Missão falhou",
  "missao.cancelada": "Missão cancelada",
  "agente.surgiu": "Agente entrou",
  "agente.estado": "Estado",
  "agente.mensagem": "Mensagem",
  "agente.finalizou": "Finalizou",
  "ferramenta.iniciada": "Ferramenta",
  "ferramenta.finalizada": "Ferramenta",
  "aprovacao.pedida": "Pedido de aprovação",
  "aprovacao.respondida": "Aprovação respondida",
};

function horario(ts: string): string {
  return new Date(ts).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function EventFeed({ eventos }: { eventos: EventoEscritorio[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum evento ainda. Simule uma missão para começar.
      </p>
    );
  }
  return (
    <ol className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
      {eventos.map((e) => (
        <li key={e.id} className="rounded-xl border border-border bg-card/60 p-3 text-sm">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-mono font-semibold text-primary">{e.agenteId}</span>
            <time dateTime={e.ts}>{horario(e.ts)}</time>
          </div>
          <p className="mt-1 font-medium">{ROTULO_TIPO[e.tipo]}</p>
          {e.texto && <p className="text-muted-foreground">{e.texto}</p>}
          {e.ferramenta && (
            <p className="text-xs text-muted-foreground">Ferramenta: {e.ferramenta.nome}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
