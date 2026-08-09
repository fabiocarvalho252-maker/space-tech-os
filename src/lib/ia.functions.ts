import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  tipo: z.enum(["diagnostico", "orcamento", "mensagem_cliente", "resumo_os", "pecas"]),
  entrada: z.string().min(1),
});

const INSTRUCOES: Record<z.infer<typeof schema>["tipo"], string> = {
  diagnostico:
    "Você é um técnico sênior de assistência técnica de celulares. Com base no aparelho e no defeito relatado abaixo, sugira um diagnóstico técnico provável e o serviço recomendado para resolvê-lo. Seja objetivo, no máximo 5 linhas, sem inventar informações que não constem no texto.",
  orcamento:
    "Você é um atendente de assistência técnica. Com base nas informações abaixo (aparelho, defeito e itens/valores), redija um texto de orçamento claro e profissional para enviar ao cliente, em português do Brasil. Inclua o que será feito e o valor, se informado. Não invente valores ou prazos que não constem no texto.",
  mensagem_cliente:
    "Você é um atendente de assistência técnica que escreve mensagens curtas e cordiais para clientes via WhatsApp. Com base no contexto abaixo, escreva uma mensagem pronta para envio, em português do Brasil, sem saudações genéricas demais nem emojis em excesso.",
  resumo_os:
    "Você é um técnico de assistência técnica. Resuma o histórico de eventos da ordem de serviço abaixo em um parágrafo curto e objetivo, destacando o que já foi feito e o status atual. Não invente eventos que não constem no texto.",
  pecas:
    "Você é um técnico sênior de assistência técnica de celulares. Com base no aparelho e no defeito relatado abaixo, liste as peças mais prováveis necessárias para o reparo, em formato de lista curta. Não invente códigos de peça específicos que não sejam de conhecimento geral do mercado.",
};

export const gerarComIA = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA indisponível no momento.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash",
        messages: [
          {
            role: "system",
            content: `${INSTRUCOES[data.tipo]} Responda apenas com o texto final, sem comentários.`,
          },
          { role: "user", content: data.entrada },
        ],
      }),
    });

    if (res.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    if (!res.ok) throw new Error("Não foi possível processar com IA.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = json?.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error("A IA não retornou nenhum texto.");
    return { texto };
  });
