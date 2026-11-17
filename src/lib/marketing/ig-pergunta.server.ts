// "Pergunte ao Claude" sobre as métricas do Instagram, pelo plano Claude Pro (CLI).
// Sem o binário do Claude no servidor, não chama nada e avisa. Envia só números agregados
// e os títulos curtos dos posts: nunca token, IDs internos ou dados de contato.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { PainelInstagram } from "./ig-metricas.server.ts";
import { TAMANHO_PERGUNTA_MAX } from "./ig-metricas.calc.ts";

const CAMINHO_PADRAO = "/root/.local/bin/claude";
const LIMITE_PERGUNTAS_DIA = 5;
const TIMEOUT_MODELO_MS = 90_000;
const MAX_TITULOS = 15;
const TAMANHO_TITULO = 60;

export type RespostaPergunta =
  { disponivel: false; motivo: string } | { disponivel: true; resposta: string };

// Usa o login do plano Claude Pro (claude.ai) pela CLI. Nunca usa chave de API:
// se houver uma no ambiente, ela é removida do processo filho.
export function claudeDisponivel(): boolean {
  return existsSync(caminhoClaude());
}

function caminhoClaude(): string {
  return process.env["CLAUDE_BIN"] || CAMINHO_PADRAO;
}

export function ambienteSemChaveApi(ambiente: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const copia: NodeJS.ProcessEnv = { ...ambiente };
  for (const chave of CHAVES_DE_API) delete copia[chave];
  return copia;
}

const CHAVES_DE_API = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "AI_API_KEY"];

// Teto diário de perguntas, para não gastar a cota do plano Pro.
let diaDoContador = "";
let perguntasNoDia = 0;
export function dentroDoLimiteDiario(agora: Date): boolean {
  const dia = agora.toISOString().slice(0, 10);
  if (dia !== diaDoContador) {
    diaDoContador = dia;
    perguntasNoDia = 0;
  }
  if (perguntasNoDia >= LIMITE_PERGUNTAS_DIA) return false;
  perguntasNoDia += 1;
  return true;
}

/** Resumo sem identificadores: o modelo só recebe números e títulos truncados. */
export function resumirParaModelo(painel: PainelInstagram): string {
  const ultimo = painel.conta.at(-1);
  const posts = [...painel.midias]
    .sort((a, b) => (b.alcance ?? -1) - (a.alcance ?? -1))
    .slice(0, MAX_TITULOS)
    .map((p) => ({
      data: p.data,
      tipo: p.tipo,
      titulo: p.legenda.slice(0, TAMANHO_TITULO),
      alcance: p.alcance,
      curtidas: p.curtidas,
      comentarios: p.comentarios,
      salvamentos: p.salvamentos,
      compartilhamentos: p.compartilhamentos,
    }));
  return JSON.stringify(
    {
      seguidoresAtuais: painel.seguidoresAtuais,
      diasDeHistorico: painel.conta.length,
      ultimoDiaConta: ultimo ?? null,
      permissoesCompletas: painel.ultimaColeta?.permissoesOk ?? null,
      posts,
    },
    null,
    0,
  );
}

const INSTRUCAO_SISTEMA =
  "Você analisa métricas de Instagram de uma assistência técnica (SPACE TECH). " +
  "Responda em português, de forma curta e objetiva, apenas com base nos dados fornecidos. " +
  "Se faltar dado para responder, diga que falta, sem estimar.";

function executarClaude(prompt: string): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const args = ["--print", "--output-format", "text", "--tools", "", "--system-prompt", INSTRUCAO_SISTEMA];
    const filho = spawn(caminhoClaude(), args, { env: ambienteSemChaveApi(process.env), stdio: ["pipe", "pipe", "pipe"] });
    let saida = "";
    let erro = "";
    const relogio = setTimeout(() => filho.kill("SIGKILL"), TIMEOUT_MODELO_MS);
    filho.stdout.on("data", (b: Buffer) => (saida += b.toString("utf8")));
    filho.stderr.on("data", (b: Buffer) => (erro += b.toString("utf8")));
    filho.on("error", (e) => {
      clearTimeout(relogio);
      rejeitar(e);
    });
    filho.on("close", (codigo) => {
      clearTimeout(relogio);
      if (codigo === 0) return resolver(saida.trim());
      const texto = `${erro} ${saida}`.toLowerCase();
      if (/limit|quota|usage/.test(texto)) return rejeitar(new Error("cota do plano Pro atingida por hoje"));
      rejeitar(new Error("Claude indisponível no momento."));
    });
    filho.stdin.end(prompt);
  });
}

export async function perguntarSobreMetricas(
  pergunta: string,
  painel: PainelInstagram,
): Promise<RespostaPergunta> {
  if (!claudeDisponivel()) {
    return { disponivel: false, motivo: "Claude Code não encontrado no servidor (CLAUDE_BIN)." };
  }
  if (!dentroDoLimiteDiario(new Date())) {
    return { disponivel: false, motivo: "Limite diário de perguntas atingido. Tente amanhã." };
  }
  const perguntaLimpa = pergunta.trim().slice(0, TAMANHO_PERGUNTA_MAX);
  const texto = await executarClaude(
    `Dados (JSON):\n${resumirParaModelo(painel)}\n\nPergunta: ${perguntaLimpa}`,
  );
  return { disponivel: true, resposta: texto || "Sem resposta do modelo." };
}
