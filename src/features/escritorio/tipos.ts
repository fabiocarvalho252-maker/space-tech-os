// Contrato de eventos do Escritório IA. Na Fase 1 os eventos vêm do roteiro
// simulado (mock/roteiro.ts); na Fase 2 o runner passará a enviar os mesmos tipos.

export type EstadoAgente =
  | "ocioso"
  | "andando"
  | "pensando"
  | "trabalhando"
  | "usando_ferramenta"
  | "aguardando_aprovacao"
  | "concluido"
  | "erro";

export type TipoEvento =
  | "missao.criada"
  | "missao.iniciada"
  | "missao.concluida"
  | "missao.falhou"
  | "missao.cancelada"
  | "agente.surgiu"
  | "agente.estado"
  | "agente.mensagem"
  | "agente.finalizou"
  | "ferramenta.iniciada"
  | "ferramenta.finalizada"
  | "aprovacao.pedida"
  | "aprovacao.respondida";

export type EventoEscritorio = {
  id: string;
  missaoId: string;
  ts: string;
  agenteId: string;
  agentePaiId?: string | undefined;
  tipo: TipoEvento;
  estado?: EstadoAgente | undefined;
  texto?: string | undefined;
  ferramenta?: { nome: string; ok?: boolean } | undefined;
  aprovacao?: { id: string; ferramenta: string; resumo: string } | undefined;
  resultado?: string | undefined;
  uso?: { entradaTokens: number; saidaTokens: number; custoUsd: number } | undefined;
};

export type StatusMissao = "ocioso" | "rodando" | "concluida" | "falhou" | "cancelada";

export type AgenteVisual = {
  id: string;
  nome: string;
  setor: string;
  estado: EstadoAgente;
  texto: string | null;
  ferramenta: string | null;
  paiId: string | null;
};
