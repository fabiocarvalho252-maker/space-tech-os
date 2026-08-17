import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chamarProvedorIA, IAIndisponivelError } from "@/lib/ai/provider.server";
import { verificarEDescontarCreditoIA, estornarCreditoIA } from "@/lib/ai/creditos.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireFeature, FeatureIndisponivelError } from "@/lib/planos/features";

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
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }): Promise<{ texto: string }> => {
    const { data: membership } = await context.supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", context.userId);
    const empresaId =
      membership?.find((m) => m.empresa_id !== context.userId)?.empresa_id ??
      membership?.[0]?.empresa_id ??
      context.userId;
    try {
      await requireFeature(empresaId, "IA_OS", context.supabase);
    } catch (e) {
      if (e instanceof FeatureIndisponivelError) throw new Error(e.message);
      throw e;
    }

    try {
      await verificarEDescontarCreditoIA(context.userId);
    } catch (e) {
      if (e instanceof IAIndisponivelError) throw new Error(e.message);
      throw e;
    }
    try {
      const resposta = await chamarProvedorIA({
        systemPrompt: `${INSTRUCOES[data.tipo]} Responda apenas com o texto final, sem comentários.`,
        mensagens: [{ role: "user", content: data.entrada }],
        tools: [],
      });
      if (resposta.kind !== "text" || !resposta.text) {
        throw new Error("A IA não retornou nenhum texto.");
      }
      return { texto: resposta.text };
    } catch (e) {
      // A credit was already spent above — refund it since the empresa
      // didn't get an answer back (provider outage, no credit on the
      // platform's own Anthropic account, etc).
      await estornarCreditoIA(context.userId);
      if (e instanceof IAIndisponivelError) throw new Error(e.message);
      throw e;
    }
  });
