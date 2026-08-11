import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  texto: z.string().min(1),
  modo: z.enum(["revisar", "melhorar"]),
});

export const ajustarLaudo = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA indisponível no momento.");

    const instrucao =
      data.modo === "revisar"
        ? "Revise o texto abaixo corrigindo ortografia, gramática e pontuação. Mantenha o mesmo sentido e o mesmo nível de detalhe."
        : "Reescreva o texto abaixo como um laudo técnico profissional de assistência técnica: claro, objetivo, em português do Brasil, sem inventar informações que não estejam no texto.";

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash",
        messages: [
          { role: "system", content: "Você é um técnico de assistência que escreve laudos técnicos. Responda apenas com o texto final, sem comentários." },
          { role: "user", content: `${instrucao}\n\nTexto:\n${data.texto}` },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados.");
    if (!res.ok) throw new Error("Não foi possível processar o texto com IA.");

    const json = (await res.json()) as any;
    const texto = json?.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error("A IA não retornou nenhum texto.");
    return { texto };
  });
