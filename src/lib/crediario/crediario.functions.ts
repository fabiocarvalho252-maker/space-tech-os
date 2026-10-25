// Server functions do crediário que precisam de segredo do servidor
// (Mercado Pago, Evolution API) ou de gerar PDF. Todo o resto do módulo vai
// direto do navegador para as funções Postgres via supabase.rpc().
//
// A empresa sai do próprio registro lido com a sessão do usuário: se o RLS
// deixou ler a parcela/contrato, o usuário tem "ver" no crediário daquela
// empresa — e é com esse id que o serviço (service role) segue.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { Cobranca } from "@/lib/pix/pix-service";
import { enviarCobrancaWhatsapp, gerarPixParcela, type ResultadoAviso } from "./crediario.server";
import { gerarPdfContratoCrediario } from "./crediario-pdf.server";

async function empresaDaParcela(supabase: SupabaseClient<Database>, parcelaId: string) {
  const { data } = await supabase
    .from("crediario_parcelas")
    .select("user_id")
    .eq("id", parcelaId)
    .maybeSingle();
  if (!data) throw new Error("Parcela não encontrada.");
  return data.user_id;
}

const parcelaSchema = z.object({ parcelaId: z.guid() });

export const gerarPixParcelaCrediarioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => parcelaSchema.parse(data))
  .handler(async ({ data, context }): Promise<Cobranca> => {
    const empresaId = await empresaDaParcela(context.supabase, data.parcelaId);
    return gerarPixParcela({
      parcelaId: data.parcelaId,
      empresaId,
      origin: new URL(getRequest().url).origin,
    });
  });

export const enviarCobrancaWhatsappCrediarioFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => parcelaSchema.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoAviso> => {
    const empresaId = await empresaDaParcela(context.supabase, data.parcelaId);
    return enviarCobrancaWhatsapp({
      parcelaId: data.parcelaId,
      empresaId,
      origin: new URL(getRequest().url).origin,
      userId: context.userId,
    });
  });

export const gerarContratoCrediarioPdfFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ contratoId: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    const { data: contrato } = await context.supabase
      .from("crediario_contratos")
      .select("user_id")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    const bytes = await gerarPdfContratoCrediario({
      contratoId: data.contratoId,
      empresaId: contrato.user_id,
    });
    return { base64: Buffer.from(bytes).toString("base64") };
  });
