import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ tipo: z.enum(["os", "venda"]), id: z.string().uuid() });

/**
 * Chamado pelas páginas públicas de avaliação (sem login) logo depois do
 * envio, para a loja receber na hora o alerta de nota baixa (1–2★). Só manda
 * o que ainda não foi avisado de uma avaliação real das últimas 24 h, então
 * chamar de novo (ou com nota alta) não faz nada; o cron cobre o que não sair
 * aqui. Nunca lança.
 */
export const avisarAvaliacaoBaixaFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { conferirAvisosDeAvaliacaoBaixa } = await import("@/lib/aviso-avaliacao-baixa.server");
    await conferirAvisosDeAvaliacaoBaixa(data);
    return { ok: true };
  });
