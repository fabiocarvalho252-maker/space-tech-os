// Thin RPC exposing os-pdf.server.ts's PDF renderer to the browser, for the
// "Enviar OS" mobile share flow (ordens.tsx + EnviarOsModal): the client
// needs actual PDF bytes to hand to navigator.share()/a download link,
// unlike imprimir() in ordens.tsx which only opens a print-ready HTML popup.
// Reuses the exact same gerarPdfOs() renderer whatsapp-service.ts already
// uses to attach OS PDFs to Evolution API messages — no second PDF
// generator. context.userId doubles as the empresa scope, same convention
// as every other server fn in src/lib/whatsapp/whatsapp.functions.ts;
// gerarPdfOs() itself scopes the query to that empresa, so a caller can
// never fetch a PDF for an OS belonging to a different empresa.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gerarPdfOs } from "@/lib/os-pdf.server";

const gerarPdfOsCompartilharSchema = z.object({
  osId: z.string().uuid(),
  modo: z.enum(["os", "orcamento"]),
});

export const gerarPdfOsCompartilharFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarPdfOsCompartilharSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ base64: string }> => {
    const bytes = await gerarPdfOs({
      osId: data.osId,
      empresaId: context.userId,
      modo: data.modo,
    });
    return { base64: Buffer.from(bytes).toString("base64") };
  });
