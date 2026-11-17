// Rota POST /office-api/equipe/sincronizar: roda um lote de perfis (admin apenas).
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { TAMANHO_LOTE_MAXIMO, type Sincronizador } from "./sincronizar.ts";

const ESQUEMA_CONSULTA = z.object({
  lote: z.coerce.number().int().min(1).max(TAMANHO_LOTE_MAXIMO).default(TAMANHO_LOTE_MAXIMO),
});

const MSG_FALHA_LOTE = "Não foi possível sincronizar agora. Tente de novo mais tarde.";

export function registrarRotaSincronizar(
  app: FastifyInstance,
  exigir: (request: FastifyRequest) => Promise<unknown>,
  sincronizador: Sincronizador,
): void {
  app.post<{ Querystring: { lote?: string } }>("/office-api/equipe/sincronizar", async (request, reply) => {
    await exigir(request);
    const consulta = ESQUEMA_CONSULTA.safeParse(request.query);
    if (!consulta.success) return reply.code(400).send({ erro: "Dados inválidos." });
    try {
      const resposta = await sincronizador.executar(consulta.data.lote);
      if (!resposta.ok) return reply.code(resposta.status).send({ erro: resposta.erro });
      return resposta.resultado;
    } catch (erro) {
      request.log.error({ erro: erro instanceof Error ? erro.message : String(erro) }, "falha na sincronização da Equipe");
      return reply.code(502).send({ erro: MSG_FALHA_LOTE });
    }
  });
}
