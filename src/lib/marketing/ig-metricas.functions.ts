// Painel de métricas do Instagram no /admin/marketing. Só o administrador do site
// (checarSiteAdmin, no servidor). Leitura do banco e coleta manual com trava.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import type { PainelInstagram } from "./ig-metricas.server";
import type { RespostaPergunta } from "./ig-pergunta.server";
import { TAMANHO_PERGUNTA_MAX } from "./ig-metricas.calc";

export type { PainelInstagram } from "./ig-metricas.server";
export type { RespostaPergunta } from "./ig-pergunta.server";

export type PainelComAnthropic = PainelInstagram & { anthropicDisponivel: boolean };

export const obterMetricasInstagram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PainelComAnthropic> => {
    checarSiteAdmin(context.claims);
    const [{ lerPainelInstagram }, { claudeDisponivel }] = await Promise.all([
      import("./ig-metricas.server"),
      import("./ig-pergunta.server"),
    ]);
    const painel = await lerPainelInstagram();
    return { ...painel, anthropicDisponivel: claudeDisponivel() };
  });

export const atualizarMetricasInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<
      { ok: true; permissoesOk: boolean; mensagem: string } | { ok: false; esperarSegundos: number }
    > => {
      checarSiteAdmin(context.claims);
      const { executarColetaManual } = await import("./ig-metricas.server");
      return executarColetaManual(new Date());
    },
  );

const perguntaSchema = z.object({
  pergunta: z.string().trim().min(3).max(TAMANHO_PERGUNTA_MAX),
});

export const perguntarMetricasInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((dados: unknown) => perguntaSchema.parse(dados))
  .handler(async ({ data, context }): Promise<RespostaPergunta> => {
    checarSiteAdmin(context.claims);
    const [{ lerPainelInstagram }, { perguntarSobreMetricas }] = await Promise.all([
      import("./ig-metricas.server"),
      import("./ig-pergunta.server"),
    ]);
    const painel = await lerPainelInstagram();
    return perguntarSobreMetricas(data.pergunta, painel);
  });
