// Cliente do office-runner no navegador. O token é o da sessão do Supabase do
// próprio admin; o WebSocket usa um ticket de uso único (o JWT nunca vai na URL).
import { supabase } from "@/integrations/supabase/client";
import type { EventoEscritorio } from "../tipos.ts";
import type { AgentProfile } from "../equipe/tipos.ts";

const BASE = "/office-api";
const ATRASO_MIN_RECONEXAO_MS = 1000;
const ATRASO_MAX_RECONEXAO_MS = 10_000;

async function tokenDaSessao(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre de novo.");
  return token;
}

async function chamar<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenDaSessao();
  // content-type só quando há corpo: o runner recusa JSON declarado sem corpo.
  const cabecalhos: Record<string, string> = { authorization: `Bearer ${token}` };
  if (init.body !== undefined) cabecalhos["content-type"] = "application/json";
  const r = await fetch(`${BASE}${caminho}`, { ...init, headers: cabecalhos });
  const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
  if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status} no runner.`);
  return corpo as T;
}

export async function runnerOnline(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

export const listarProjetos = () => chamar<{ projetos: string[] }>("/projects");

export const criarMissaoReal = (prompt: string, projectId: string, mode: "seguro" | "automatico") =>
  chamar<{ id: string; status: string }>("/missions", {
    method: "POST",
    body: JSON.stringify({ prompt, projectId, mode }),
  });

export const decidirAprovacaoReal = (aprovacaoId: string, decision: "permitir" | "negar") =>
  chamar<{ ok: boolean }>(`/approvals/${encodeURIComponent(aprovacaoId)}`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });

export const eventosDaMissaoReal = (missaoId: string) =>
  chamar<{ eventos: import("../tipos.ts").EventoEscritorio[] }>(
    `/missions/${encodeURIComponent(missaoId)}/events`,
  );

export const cancelarMissaoReal = (missaoId: string) =>
  chamar<{ ok: boolean }>(`/missions/${encodeURIComponent(missaoId)}/cancel`, { method: "POST" });

export const CHAVE_CONSULTA_EQUIPE = ["office-equipe"] as const;

/** Campos editáveis de um perfil da equipe (o que o admin pode alterar). */
export type DadosPerfilEquipe = {
  displayName: string;
  roleTitle: string;
  summaryPtBr: string;
  descriptionPtBr: string;
  whenToUse: string[];
  sector: string;
};

export const listarEquipe = () => chamar<{ perfis: AgentProfile[] }>("/equipe");

export const salvarPerfil = (agentId: string, dados: DadosPerfilEquipe) =>
  chamar<{ ok: true; perfil: AgentProfile }>(`/equipe/${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    body: JSON.stringify(dados),
  });

// Abre o fluxo de eventos. Reconecta sozinho com atraso crescente e pede o
// replay a partir do último evento recebido, para não perder nada.
export function abrirFluxo(onEvento: (e: EventoEscritorio) => void): () => void {
  let ultimoId: string | undefined;
  let fechadoManualmente = false;
  let atraso = ATRASO_MIN_RECONEXAO_MS;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function conectar(): Promise<void> {
    if (fechadoManualmente) return;
    try {
      const { ticket } = await chamar<{ ticket: string }>("/ws-ticket", { method: "POST" });
      const protocolo = window.location.protocol === "https:" ? "wss" : "ws";
      const depois = ultimoId ? `&after=${encodeURIComponent(ultimoId)}` : "";
      socket = new WebSocket(
        `${protocolo}://${window.location.host}/office-ws?ticket=${ticket}${depois}`,
      );
      socket.onopen = () => {
        atraso = ATRASO_MIN_RECONEXAO_MS;
      };
      socket.onmessage = (m: MessageEvent) => {
        const evento = JSON.parse(String(m.data)) as EventoEscritorio;
        ultimoId = evento.id;
        onEvento(evento);
      };
      socket.onclose = () => agendarReconexao();
    } catch {
      agendarReconexao();
    }
  }

  function agendarReconexao(): void {
    if (fechadoManualmente) return;
    timer = setTimeout(() => void conectar(), atraso);
    atraso = Math.min(atraso * 2, ATRASO_MAX_RECONEXAO_MS);
  }

  void conectar();
  return () => {
    fechadoManualmente = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
}
