// Thin abstraction over the AI provider actually used for chat completions +
// tool calling. AI_PROVIDER picks the implementation without callers
// (chat.functions.ts) changing at all:
//   - "anthropic": Anthropic Messages API directly.
//   - "omniroute" / "openai": any OpenAI-compatible /chat/completions endpoint
//     (OmniRoute gateway by default, see infra/omniroute/), at AI_BASE_URL.
//
// Callers always keep the conversation in Anthropic's shape (tool_use /
// tool_result content blocks); the OpenAI-compatible path translates that
// history on every call, so switching providers never changes the callers.

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
  const baseUrl = (process.env["AI_BASE_URL"] || "http://127.0.0.1:20128/v1").replace(/\/+$/, "");
  return { provider, model, apiKey, baseUrl };
}

export async function chamarProvedorIA(params: {
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mensagens: any[];
  tools: ToolSpec[];
}): Promise<ProviderResponse> {
  const { provider, model, apiKey, baseUrl } = configuracao();
  if (!apiKey) {
    throw new IAIndisponivelError(
      "IA indisponível: nenhuma AI_API_KEY configurada no servidor (veja .env.example).",
    );
  }
  if (provider === "anthropic") return chamarAnthropic({ ...params, model, apiKey });
  if (provider === "omniroute" || provider === "openai") {
    return chamarOpenAICompativel({ ...params, model, apiKey, baseUrl });
  }
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function paraMensagensOpenAI(systemPrompt: string, mensagens: any[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saida: any[] = [{ role: "system", content: systemPrompt }];
  for (const m of mensagens) {
    if (typeof m.content === "string") {
      saida.push({ role: m.role, content: m.content });
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocos: any[] = Array.isArray(m.content) ? m.content : [];
    if (m.role === "assistant") {
      const texto = blocos
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const chamadas = blocos
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      saida.push({
        role: "assistant",
        content: texto || null,
        ...(chamadas.length > 0 ? { tool_calls: chamadas } : {}),
      });
      continue;
    }
    for (const b of blocos) {
      if (b.type === "tool_result") {
        saida.push({ role: "tool", tool_call_id: b.tool_use_id, content: String(b.content ?? "") });
      } else if (b.type === "text") {
        saida.push({ role: "user", content: b.text });
      }
    }
  }
  return saida;
}

async function chamarOpenAICompativel(params: {
  systemPrompt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mensagens: any[];
  tools: ToolSpec[];
  model: string;
  apiKey: string;
  baseUrl: string;
}): Promise<ProviderResponse> {
  let res: Response;
  try {
    res = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${params.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: 1024,
        messages: paraMensagensOpenAI(params.systemPrompt, params.mensagens),
        ...(params.tools.length > 0
          ? {
              tools: params.tools.map((t) => ({
                type: "function",
                function: { name: t.name, description: t.description, parameters: t.input_schema },
              })),
            }
          : {}),
      }),
    });
  } catch {
    throw new IAIndisponivelError("IA indisponível: não foi possível conectar ao gateway de IA.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new IAIndisponivelError("IA indisponível: credenciais do provedor inválidas.");
  }
  if (res.status === 429) {
    throw new IAIndisponivelError("Limite de uso da IA atingido. Tente novamente em instantes.");
  }
  if (!res.ok) throw new IAIndisponivelError("IA indisponível no momento.");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  const mensagem = json?.choices?.[0]?.message ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chamadas: any[] = mensagem.tool_calls ?? [];

  if (chamadas.length > 0) {
    const calls = chamadas.map((c) => {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(c.function?.arguments || "{}");
      } catch {
        // Argumentos malformados viram {} — a ferramenta responde com erro de validação.
      }
      return { id: c.id, name: c.function?.name, input };
    });
    // Replayed by chat.functions.ts as the assistant turn — kept in
    // Anthropic block shape so history stays provider-agnostic.
    const assistantRaw = [
      ...(mensagem.content ? [{ type: "text", text: mensagem.content }] : []),
      ...calls.map((c) => ({ type: "tool_use", id: c.id, name: c.name, input: c.input })),
    ];
    return { kind: "tool_calls", calls, assistantRaw };
  }

  const texto = typeof mensagem.content === "string" ? mensagem.content.trim() : "";
  return { kind: "text", text: texto || "Não consegui gerar uma resposta." };
}
