// Geração de texto pelo Agent SDK, sem ferramentas e com o login do plano Pro.
// Usa o mesmo caminho das missões (que já roda como o usuário do serviço), por isso não
// depende do binário do Claude instalado na pasta do root.
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ambienteSemChaveApi } from "../missoes/executar.ts";

export const SISTEMA_PERFIS =
  "Você escreve perfis em português para a Equipe do SPACE TECH. Responda apenas com JSON puro.";

export async function gerarComSdk(prompt: string): Promise<string> {
  let texto: string | null = null;
  for await (const mensagem of query({
    prompt,
    options: {
      tools: [],
      maxTurns: 1,
      systemPrompt: SISTEMA_PERFIS,
      settingSources: [],
      env: ambienteSemChaveApi(process.env),
    },
  })) {
    if (mensagem.type !== "result") continue;
    if (mensagem.subtype !== "success") throw new Error("Claude não respondeu a geração.");
    texto = mensagem.result;
  }
  if (texto === null) throw new Error("Claude não devolveu resposta.");
  return texto;
}
