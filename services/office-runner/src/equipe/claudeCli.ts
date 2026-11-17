// Chamada do Claude pela CLI, sem ferramentas, com o login do plano Pro.
// Mesma técnica do "Pergunte ao Claude" do Instagram: o ambiente do processo filho
// não recebe chaves de API.
import { spawn } from "node:child_process";
import { ambienteSemChaveApi } from "../missoes/executar.ts";

export const CAMINHO_CLAUDE_PADRAO = "/root/.local/bin/claude";
export const TIMEOUT_LOTE_MS = 180_000;
const INSTRUCAO_SISTEMA = "Você escreve perfis em português para a Equipe do SPACE TECH. Responda apenas com JSON puro.";

export function caminhoClaude(ambiente: NodeJS.ProcessEnv): string {
  return ambiente["CLAUDE_BIN"] || CAMINHO_CLAUDE_PADRAO;
}

export function argumentosClaude(): string[] {
  return ["--print", "--output-format", "text", "--tools", "", "--system-prompt", INSTRUCAO_SISTEMA];
}

export function gerarComClaude(prompt: string, ambiente: NodeJS.ProcessEnv = process.env): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const filho = spawn(caminhoClaude(ambiente), argumentosClaude(), {
      env: ambienteSemChaveApi(ambiente),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let saida = "";
    let erro = "";
    let expirou = false;
    const relogio = setTimeout(() => {
      expirou = true;
      filho.kill("SIGKILL");
    }, TIMEOUT_LOTE_MS);
    filho.stdout.on("data", (bytes: Buffer) => (saida += bytes.toString("utf8")));
    filho.stderr.on("data", (bytes: Buffer) => (erro += bytes.toString("utf8")));
    filho.on("error", (falha) => {
      clearTimeout(relogio);
      rejeitar(falha);
    });
    filho.on("close", (codigo) => {
      clearTimeout(relogio);
      if (expirou) return rejeitar(new Error("Claude demorou demais para responder ao lote."));
      if (codigo === 0) return resolver(saida.trim());
      const texto = `${erro} ${saida}`.toLowerCase();
      if (/limit|quota|usage/.test(texto)) return rejeitar(new Error("cota do plano Pro atingida por hoje"));
      rejeitar(new Error("Claude indisponível no momento."));
    });
    filho.stdin.end(prompt);
  });
}
