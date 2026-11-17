// Painel do inspetor: mostra o estado atual de um agente e as últimas mensagens
// e eventos dele. Os dados vêm do estado da missão; o painel não guarda nada.

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EstadoMissao } from "../estado.ts";
import { SETORES } from "../game/layout.ts";
import type { AgenteVisual, EstadoAgente, EventoEscritorio, TipoEvento } from "../tipos.ts";

const QUANTIDADE_EVENTOS = 10;

const ROTULO_ESTADO: Record<EstadoAgente, string> = {
  ocioso: "ocioso",
  andando: "andando",
  pensando: "pensando",
  trabalhando: "trabalhando",
  usando_ferramenta: "usando ferramenta",
  aguardando_aprovacao: "aguardando aprovação",
  concluido: "concluído",
  erro: "erro",
};

const ROTULO_EVENTO: Record<TipoEvento, string> = {
  "missao.criada": "Missão criada",
  "missao.iniciada": "Missão iniciada",
  "missao.concluida": "Missão concluída",
  "missao.falhou": "Missão falhou",
  "missao.cancelada": "Missão cancelada",
  "agente.surgiu": "Agente entrou",
  "agente.estado": "Mudou de estado",
  "agente.mensagem": "Mensagem",
  "agente.finalizou": "Finalizou",
  "ferramenta.iniciada": "Ferramenta iniciada",
  "ferramenta.finalizada": "Ferramenta finalizada",
  "aprovacao.pedida": "Aprovação pedida",
  "aprovacao.respondida": "Aprovação respondida",
};

type Props = {
  agenteId: string | null;
  estado: EstadoMissao;
  onFechar: () => void;
};

function nomeDoSetor(setorId: string): string {
  return SETORES.find((setor) => setor.id === setorId)?.nome ?? setorId;
}

function nomeDoPai(agente: AgenteVisual, estado: EstadoMissao): string {
  if (!agente.paiId) return "Nenhum (agente principal)";
  return estado.agentes[agente.paiId]?.nome ?? agente.paiId;
}

function horaDe(ts: string): string {
  const data = new Date(ts);
  if (Number.isNaN(data.getTime())) return "--:--";
  return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function descricaoDoEvento(evento: EventoEscritorio): string {
  const partes = [ROTULO_EVENTO[evento.tipo]];
  if (evento.ferramenta) partes.push(`ferramenta: ${evento.ferramenta.nome}`);
  if (evento.texto) partes.push(evento.texto);
  return partes.join(" · ");
}

function eventosDoAgente(estado: EstadoMissao, agenteId: string): EventoEscritorio[] {
  return estado.eventos.filter((evento) => evento.agenteId === agenteId).slice(-QUANTIDADE_EVENTOS);
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm break-words">{valor}</dd>
    </div>
  );
}

function ListaEventos({ eventos }: { eventos: EventoEscritorio[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum evento deste agente ainda.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {eventos.map((evento) => (
        <li key={evento.id} className="flex gap-3 text-sm">
          <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
            {horaDe(evento.ts)}
          </span>
          <span className="break-words">{descricaoDoEvento(evento)}</span>
        </li>
      ))}
    </ol>
  );
}

export function AgentInspector({ agenteId, estado, onFechar }: Props) {
  if (agenteId === null) return null;

  const agente = estado.agentes[agenteId];
  const eventos = eventosDoAgente(estado, agenteId);

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">{agente?.nome ?? agenteId}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onFechar} aria-label="Fechar inspetor">
          <X className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {agente ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Setor" valor={nomeDoSetor(agente.setor)} />
            <Campo rotulo="Estado" valor={ROTULO_ESTADO[agente.estado]} />
            <Campo rotulo="Texto atual" valor={agente.texto ?? "—"} />
            <Campo rotulo="Ferramenta em uso" valor={agente.ferramenta ?? "—"} />
            <Campo rotulo="Delegado por" valor={nomeDoPai(agente, estado)} />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Agente não encontrado nesta missão.</p>
        )}
        <section aria-labelledby="inspetor-eventos" className="flex flex-col gap-2">
          <h3 id="inspetor-eventos" className="text-sm font-medium">
            Últimas mensagens e eventos
          </h3>
          <ListaEventos eventos={eventos} />
        </section>
      </CardContent>
    </Card>
  );
}
