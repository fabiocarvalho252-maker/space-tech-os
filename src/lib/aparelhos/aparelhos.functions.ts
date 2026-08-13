// Server functions for the "Aparelhos" module that need something plain
// client-side supabase calls (the pattern seminovos.tsx/produtos.tsx/
// vendas.tsx use, relying on RLS alone) can't do:
//   - redacting preco_custo/lucro from the response for roles that
//     shouldn't see them (RLS is row-level only — this needs field-level
//     redaction, enforced here, not just hidden in the UI, per the
//     project's requirement that cost/profit never reach an unauthorized
//     caller even directly through the API);
//   - generating the comprovante/termo de garantia PDFs and handing the
//     bytes to the browser's share sheet, same pattern as
//     os-pdf-share.functions.ts.
//
// Everything else (create/edit aparelho, upload fotos, call the
// vender_aparelho/reservar_aparelho/... RPCs) goes straight from the
// client via the `supabase` browser client, exactly like every other
// module in this app — no server function needed since RLS already gates
// row access and the RPCs already validate permissions themselves.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  gerarPdfComprovanteAparelho,
  gerarPdfTermoGarantiaAparelho,
} from "@/lib/aparelho-pdf.server";

/**
 * Resolves the empresa (tenant) id for the calling user — the owner's own
 * id if they *are* the empresa, or the empresa they were invited into
 * otherwise. Same membership lookup trial.functions.ts uses server-side;
 * done here via the caller's own RLS-scoped client (not supabaseAdmin)
 * since `user_empresas`' "user_id = auth.uid()" SELECT policy already lets
 * every member read their own membership row.
 */
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

type AparelhoRow = Database["public"]["Tables"]["aparelhos"]["Row"];

async function podeVerCustoAparelho(
  supabase: SupabaseClient<Database>,
  empresaId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("pode_ver_custo_aparelho", { p_empresa_id: empresaId });
  return !!data;
}

export const listarAparelhosComCustoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ aparelhos: AparelhoRow[]; podeVerCusto: boolean }> => {
    const empresaId = await resolverEmpresaId(context.supabase, context.userId);
    const [{ data, error }, podeVerCusto] = await Promise.all([
      context.supabase.from("aparelhos").select("*").order("created_at", { ascending: false }),
      podeVerCustoAparelho(context.supabase, empresaId),
    ]);
    if (error) throw error;

    const aparelhos = podeVerCusto
      ? (data ?? [])
      : (data ?? []).map((a) => ({ ...a, preco_custo: 0 }));
    return { aparelhos, podeVerCusto };
  });

const obterAparelhoSchema = z.object({ aparelhoId: z.string().uuid() });

export const obterAparelhoComCustoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => obterAparelhoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ aparelho: AparelhoRow; podeVerCusto: boolean }> => {
    const empresaId = await resolverEmpresaId(context.supabase, context.userId);
    const [{ data: aparelho, error }, podeVerCusto] = await Promise.all([
      context.supabase.from("aparelhos").select("*").eq("id", data.aparelhoId).single(),
      podeVerCustoAparelho(context.supabase, empresaId),
    ]);
    if (error || !aparelho) throw new Error("Aparelho não encontrado.");

    return { aparelho: podeVerCusto ? aparelho : { ...aparelho, preco_custo: 0 }, podeVerCusto };
  });

const gerarComprovanteSchema = z.object({ vendaId: z.string().uuid() });

/** Same "share sheet" pattern as os-pdf-share.functions.ts's gerarPdfOsCompartilharFn. */
export const gerarComprovanteAparelhoCompartilharFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarComprovanteSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    const empresaId = await resolverEmpresaId(context.supabase, context.userId);
    const bytes = await gerarPdfComprovanteAparelho({ vendaId: data.vendaId, empresaId });
    return { base64: Buffer.from(bytes).toString("base64") };
  });

const gerarTermoGarantiaSchema = z.object({ garantiaId: z.string().uuid() });

export const gerarTermoGarantiaAparelhoCompartilharFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarTermoGarantiaSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    const empresaId = await resolverEmpresaId(context.supabase, context.userId);
    const bytes = await gerarPdfTermoGarantiaAparelho({ garantiaId: data.garantiaId, empresaId });
    return { base64: Buffer.from(bytes).toString("base64") };
  });
