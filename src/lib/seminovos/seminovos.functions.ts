// Server function para o comprovante de compra de seminovo — mesmo padrão
// de gerarComprovanteAparelhoCompartilharFn em aparelhos.functions.ts
// (gera o PDF no servidor com supabaseAdmin, devolve base64 para o
// navegador montar o File/share sheet). Só o necessário para o PDF vive
// aqui; o resto do CRUD de seminovos continua indo direto do client via
// RLS, como o resto do módulo já faz.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { gerarPdfComprovanteSeminovo } from "@/lib/seminovo-pdf.server";

async function resolverEmpresaId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: memberships } = await supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", userId);
  if (!memberships?.length) return userId;
  return memberships.find((m) => m.empresa_id !== userId)?.empresa_id ?? memberships[0]!.empresa_id;
}

const gerarComprovanteSchema = z.object({ seminovoId: z.string().uuid() });

export const gerarComprovanteSeminovoCompartilharFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarComprovanteSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    const empresaId = await resolverEmpresaId(context.supabase, context.userId);
    const bytes = await gerarPdfComprovanteSeminovo({ seminovoId: data.seminovoId, empresaId });
    return { base64: Buffer.from(bytes).toString("base64") };
  });
