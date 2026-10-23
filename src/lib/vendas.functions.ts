// Comprovante de venda para o navegador (mesmo padrão "share sheet" de
// os-pdf-share.functions.ts e aparelhos.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarPdfComprovanteVenda } from "@/lib/venda-pdf.server";

const gerarComprovanteVendaSchema = z.object({ vendaId: z.string().uuid() });

export const gerarComprovanteVendaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarComprovanteVendaSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    // Lê pela sessão do próprio usuário: a RLS de vendas decide se ele pode
    // ver esta venda, e a empresa sai da própria linha. Só depois o PDF é
    // montado com supabaseAdmin.
    const { data: venda } = await context.supabase
      .from("vendas")
      .select("user_id")
      .eq("id", data.vendaId)
      .maybeSingle();
    if (!venda) throw new Error("Venda não encontrada.");
    const bytes = await gerarPdfComprovanteVenda({
      vendaId: data.vendaId,
      empresaId: venda.user_id,
    });
    return { base64: Buffer.from(bytes).toString("base64") };
  });
