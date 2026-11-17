// Executa uma missão com o Agent SDK: passa as mensagens pelo normalizador,
// aplica a política de ferramentas, pede aprovação quando preciso e respeita
// limites de tempo, custo e cancelamento.
import type { Options, PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { decidirFerramenta } from "../seguranca/politica.ts";
import { normalizarMensagem, type ContextoMissao } from "../eventos/normalizar.ts";
import type { Repositorio, Missao } from "./repositorio.ts";
import type { EventoEscritorio } from "../tipos.ts";

export type Consulta = (params: { prompt: string; options?: Options }) => AsyncIterable<unknown>;

export type LimitesExecucao = {
  projetoRaiz: string;
  maxTurns: number;
  maxCustoUsd: number;
  maxMinutos: number;
  timeoutAprovacaoMs: number;
};

// O runner usa só o login do plano Claude (claude.ai). Se houver chave de API
// no ambiente, o SDK cobraria da API; por isso ela é removida do ambiente filho.
// Lista permitida: o agente não herda segredos do runner (service role, chaves, e-mails).
const VARIAVEIS_PERMITIDAS = ["PATH", "HOME", "LANG", "LC_ALL", "TERM", "USER", "TMPDIR", "CLAUDE_CONFIG_DIR"];

export function ambienteSemChaveApi(ambiente: NodeJS.ProcessEnv): Record<string, string> {
  const copia: Record<string, string> = {};
  for (const chave of VARIAVEIS_PERMITIDAS) {
    const valor = ambiente[chave];
    if (valor !== undefined) copia[chave] = valor;
  }
  return copia;
}

export const PROMPT_DIRETOR = [
  "Você é o Diretor do Escritório IA do SPACE TECH.",
  "Divida o pedido em tarefas, delegue aos subagentes do ECC mais adequados",
  "e entregue um resumo final em português, em poucas frases.",
  "Não faça alterações fora do projeto indicado e não crie commits na branch principal.",
].join(" ");

export async function executarMissao(
  missao: Missao,
  repo: Repositorio,
  consulta: Consulta,
  limites: LimitesExecucao,
): Promise<void> {
  const ctx: ContextoMissao = {
    missaoId: missao.id,
    proximoId: repo.proximoId,
    agora: repo.agora,
    subagentes: new Map(),
  };
  const emitir = (evento: EventoEscritorio) => repo.publicar(evento);
  let terminou = false;
  const marcarTerminou = (status: "concluida" | "falhou" | "cancelada") => {
    if (terminou) return;
    terminou = true;
    repo.marcarStatus(missao.id, status);
  };

  const tempo = setTimeout(() => {
    missao.controlador.abort(new Error("tempo esgotado"));
  }, limites.maxMinutos * 60_000);

  repo.marcarStatus(missao.id, "rodando");

  const options: Options = {
    cwd: `${limites.projetoRaiz}/${missao.projeto}`,
    settingSources: ["user", "project"],
    env: ambienteSemChaveApi(process.env),
    permissionMode: "default",
    maxTurns: limites.maxTurns,
    maxBudgetUsd: limites.maxCustoUsd,
    abortController: missao.controlador,
    systemPrompt: { type: "preset", preset: "claude_code", append: PROMPT_DIRETOR },
    canUseTool: async (ferramenta, entrada): Promise<PermissionResult> => {
      const decisao = decidirFerramenta({
        ferramenta,
        entrada,
        modo: missao.modo,
        projetoRaiz: `${limites.projetoRaiz}/${missao.projeto}`,
      });
      if (decisao.comportamento === "permitir") return { behavior: "allow", updatedInput: entrada };
      if (decisao.comportamento === "negar") return { behavior: "deny", message: decisao.motivo };
      return pedirAprovacao(missao, repo, emitir, ferramenta, entrada, decisao.motivo, limites.timeoutAprovacaoMs);
    },
  };

  try {
    for await (const mensagem of consulta({ prompt: missao.prompt, options })) {
      for (const evento of normalizarMensagem(ctx, mensagem as unknown as { type: string; [k: string]: unknown })) {
        emitir(evento);
        if (evento.tipo === "missao.concluida") marcarTerminou("concluida");
        if (evento.tipo === "missao.falhou") marcarTerminou("falhou");
      }
    }
    if (!terminou) {
      emitir(evento(repo, missao.id, "missao.falhou", "A missão terminou sem resultado."));
      marcarTerminou("falhou");
    }
  } catch (erro) {
    if (terminou) return;
    const cancelada = missao.controlador.signal.aborted && missao.controlador.signal.reason?.message !== "tempo esgotado";
    const motivo = missao.controlador.signal.reason instanceof Error ? missao.controlador.signal.reason.message : null;
    if (cancelada) {
      emitir(evento(repo, missao.id, "missao.cancelada", "Missão parada."));
      marcarTerminou("cancelada");
    } else {
      const texto = motivo === "tempo esgotado" ? "Tempo máximo da missão atingido." : mensagemDeErro(erro);
      emitir(evento(repo, missao.id, "missao.falhou", texto));
      marcarTerminou("falhou");
    }
  } finally {
    clearTimeout(tempo);
    repo.cancelarAprovacoesDaMissao(missao.id);
  }
}

function evento(repo: Repositorio, missaoId: string, tipo: EventoEscritorio["tipo"], texto: string): EventoEscritorio {
  return { id: repo.proximoId(), missaoId, ts: repo.agora(), agenteId: "orchestrator", tipo, estado: tipo === "missao.cancelada" ? "ocioso" : "erro", texto };
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message.slice(0, 200) : "Erro desconhecido na missão.";
}

async function pedirAprovacao(
  missao: Missao,
  repo: Repositorio,
  emitir: (e: EventoEscritorio) => void,
  ferramenta: string,
  entrada: Record<string, unknown>,
  motivo: string,
  timeoutMs: number,
): Promise<PermissionResult> {
  const aprovacaoId = repo.proximoId();
  emitir({
    id: repo.proximoId(),
    missaoId: missao.id,
    ts: repo.agora(),
    agenteId: "orchestrator",
    tipo: "aprovacao.pedida",
    estado: "aguardando_aprovacao",
    texto: motivo.slice(0, 120),
    aprovacao: { id: aprovacaoId, ferramenta, resumo: resumirEntrada(entrada) },
  });
  const decisao = await repo.aguardarAprovacao(aprovacaoId, missao.id, timeoutMs);
  emitir({
    id: repo.proximoId(),
    missaoId: missao.id,
    ts: repo.agora(),
    agenteId: "orchestrator",
    tipo: "aprovacao.respondida",
    estado: decisao === "permitir" ? "trabalhando" : "concluido",
    texto: decisao === "permitir" ? "Aprovado." : "Negado.",
  });
  return decisao === "permitir"
    ? { behavior: "allow", updatedInput: entrada }
    : { behavior: "deny", message: "Negado pelo administrador." };
}

export function resumirEntrada(entrada: Record<string, unknown>): string {
  const caminho = entrada["file_path"] ?? entrada["path"] ?? entrada["command"] ?? "";
  return String(caminho).slice(0, 200);
}

