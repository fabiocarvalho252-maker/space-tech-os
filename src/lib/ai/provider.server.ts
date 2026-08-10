// Thin abstraction over the AI provider actually used for chat completions +
// tool calling. Only "anthropic" is implemented today; AI_PROVIDER exists so
// a second implementation (e.g. "openai") can be added later without callers
// (chat.functions.ts) changing at all.

export class IAIndisponivelError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "IAIndisponivelError";
  }
}

export type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };
export type ProviderToolCall = { id: string; name: string; input: Record<string, unknown> };
export type ProviderResponse =
  | { kind: "text"; text: string }
  // assistantRaw is the provider's own content-block shape for the assistant
  // turn that requested tools — it has to be replayed back verbatim on the
  // next call, so it's intentionally opaque here rather than normalized.
  | { kind: "tool_calls"; calls: ProviderToolCall[]; assistantRaw: unknown };

function configuracao() {
  const provider = process.env["AI_PROVIDER"] || "anthropic";
  const model = process.env["AI_MODEL"] || "claude-sonnet-5";
  const apiKey = process.env["AI_API_KEY"];
  return { provider, model, apiKey };
}

export async function chamarProvedorIA(params: {
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mensagens: any[];
  tools: ToolSpec[];
}): Promise<ProviderResponse> {
  const { provider, model, apiKey } = configuracao();
  if (!apiKey) {
    throw new IAIndisponivelError(
      "IA indisponível: nenhuma AI_API_KEY configurada no servidor (veja .env.example).",
    );
  }
  if (provider === "anthropic") return chamarAnthropic({ ...params, model, apiKey });
  throw new IAIndisponivelError(`Provedor de IA "${provider}" ainda não implementado.`);
}

async function chamarAnthropic(params: {
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mensagens: any[];
  tools: ToolSpec[];
  model: string;
  apiKey: string;
}): Promise<ProviderResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: 1024,
      system: params.systemPrompt,
      messages: params.mensagens,
      tools: params.tools,
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new IAIndisponivelError("IA indisponível: credenciais do provedor inválidas.");
  }
  if (res.status === 429) {
    throw new IAIndisponivelError("Limite de uso da IA atingido. Tente novamente em instantes.");
  }
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    if (corpo.toLowerCase().includes("credit balance")) {
      throw new IAIndisponivelError("IA indisponível: sem crédito na conta do provedor de IA.");
    }
    throw new IAIndisponivelError("IA indisponível no momento.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocos: any[] = json?.content ?? [];
  const blocosFerramenta = blocos.filter((b) => b.type === "tool_use");

  if (blocosFerramenta.length > 0) {
    return {
      kind: "tool_calls",
      calls: blocosFerramenta.map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} })),
      assistantRaw: blocos,
    };
  }

  const texto = blocos
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return { kind: "text", text: texto || "Não consegui gerar uma resposta." };
}
