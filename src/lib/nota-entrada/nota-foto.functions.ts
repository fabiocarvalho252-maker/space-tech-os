import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consultarIA } from "@/lib/ai/consulta.server";
import type { NotaEntrada } from "./nfe-xml.ts";
import { extrairJson, normalizarNotaFoto, PROMPT_NOTA_FOTO } from "./nota-foto.ts";

const MAX_IMAGENS = 4;
// Foto já reduzida no navegador (~1600px JPEG) fica bem abaixo deste limite.
const MAX_BASE64_CHARS = 3_000_000;

const entradaSchema = z.object({
  imagens: z
    .array(
      z.object({
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(100).max(MAX_BASE64_CHARS),
      }),
    )
    .min(1)
    .max(MAX_IMAGENS),
});

const MENSAGEM_LEITURA =
  "Não consegui ler os produtos desta imagem. Tente uma foto mais nítida, com a nota inteira.";

// Lê a nota de compra a partir de foto ou escaneamento. O resultado vai para a
// mesma prévia da importação por XML: nada é lançado sem confirmação do usuário.
export const lerNotaFotoIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => entradaSchema.parse(data))
  .handler(async ({ data, context }): Promise<NotaEntrada> => {
    const { texto } = await consultarIA(context, {
      systemPrompt: PROMPT_NOTA_FOTO,
      texto: "Leia a nota de compra nas imagens e responda apenas com o JSON.",
      imagens: data.imagens,
      pesquisar: false,
      // Preço e quantidade errados entram no estoque: prefere o modelo mais preciso.
      preferirPago: true,
    });

    try {
      return normalizarNotaFoto(extrairJson(texto));
    } catch (e) {
      console.error("[nota-foto] resposta inválida", e instanceof Error ? e.message : e);
      throw new Error(MENSAGEM_LEITURA);
    }
  });
