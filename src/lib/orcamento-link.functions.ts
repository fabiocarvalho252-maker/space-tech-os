import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const avisoSchema = z.object({ osId: z.string().uuid() });

/**
 * Chamado pela página do cliente (/consulta/:id, sem login) logo depois de
 * ele aprovar ou recusar o orçamento, para a loja receber o aviso no
 * WhatsApp na hora. Só manda o que ainda não foi avisado de uma resposta
 * real das últimas 24 h, então chamar de novo não repete nada; o cron cobre
 * o que não sair aqui. Nunca lança.
 */
export const avisarOrcamentoRespondidoFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => avisoSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { conferirAvisosDeOrcamento } = await import("@/lib/aviso-orcamento-respondido.server");
    await conferirAvisosDeOrcamento(data.osId);
    return { ok: true };
  });
