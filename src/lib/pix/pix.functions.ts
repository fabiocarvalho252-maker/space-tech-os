// Server function behind "Gerar Pix" in cobrancas.tsx. Same pattern as
// every other *.functions.ts here: createServerFn + requireSupabaseAuth.
//
// Staff-only by construction: context.userId is used directly as the
// empresa id (matches how every table in this app is scoped — the caller
// can only ever create a cobranca under their own empresa's Mercado Pago
// credentials, never someone else's).
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { criarCobrancaPix, verificarPagamentoCobranca, type Cobranca } from "./pix-service";

const schema = z.object({
  valor: z.number().positive(),
  clienteId: z.string().uuid().nullable(),
  osId: z.string().uuid().nullable(),
  vendaId: z.string().uuid().nullable(),
});

export const criarCobrancaPixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }): Promise<Cobranca> => {
    const origin = new URL(getRequest().url).origin;
    return criarCobrancaPix({
      empresaId: context.userId,
      valor: data.valor,
      clienteId: data.clienteId,
      osId: data.osId,
      vendaId: data.vendaId,
      origin,
    });
  });

// Fallback for when Mercado Pago's webhook never reaches this deploy (a
// stale/unreachable notification_url, a dropped delivery, ...) — re-checks
// the payment directly against Mercado Pago's API instead of waiting.
export const verificarPagamentoPixFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ cobrancaId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<void> => {
    await verificarPagamentoCobranca(data.cobrancaId, context.userId);
  });
