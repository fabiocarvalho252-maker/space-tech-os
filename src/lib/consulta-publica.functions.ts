// Área do Cliente (/consulta/:id, sem login): fotos e PDF da OS.
// O bucket "os-fotos" é privado e o cliente não tem sessão, então o servidor
// (service role) gera links temporários. Mesma regra das funções públicas do
// banco (consultar_os_publica...): só pelo UUID da OS, que é o que o QR Code
// e o link do WhatsApp levam — o número sequencial nunca abre nada.
// Assinaturas ficam de fora da galeria.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ osId: z.guid() });

export type FotoOsPublica = { url: string; categoria: string; criadaEm: string | null };

const CATEGORIAS_FORA = new Set(["assinatura_cliente", "assinatura_tecnico"]);

export const fotosOsPublicaFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<FotoOsPublica[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fotos, error } = await supabaseAdmin
      .from("service_order_photos")
      .select("url, category, created_at")
      .eq("service_order_id", data.osId)
      .order("created_at");
    if (error) throw new Error("Não foi possível carregar as fotos.");

    const galeria = (fotos ?? []).filter((f) => !CATEGORIAS_FORA.has(f.category ?? ""));
    if (!galeria.length) return [];

    const { data: assinadas } = await supabaseAdmin.storage
      .from("os-fotos")
      .createSignedUrls(
        galeria.map((f) => f.url),
        60 * 60,
      );
    // O servidor fala com o Supabase por localhost; o navegador do cliente
    // precisa do domínio público.
    const publico = process.env["SUPABASE_PUBLIC_URL"] || process.env["VITE_SUPABASE_URL"];
    const paraPublico = (u: string) => {
      if (!u || !publico) return u;
      const link = new URL(u);
      const base = new URL(publico);
      link.protocol = base.protocol;
      link.host = base.host;
      link.port = base.port;
      return link.toString();
    };
    return galeria
      .map((f, i) => ({
        url: paraPublico(assinadas?.[i]?.signedUrl ?? ""),
        categoria: f.category ?? "entrada",
        criadaEm: f.created_at,
      }))
      .filter((f) => f.url);
  });

/** O mesmo PDF que a loja envia pelo WhatsApp (orçamento enquanto aguarda aprovação). */
export const pdfOsPublicaFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<{ base64: string; numero: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: os } = await supabaseAdmin
      .from("ordens_servico")
      .select("user_id, numero, status")
      .eq("id", data.osId)
      .maybeSingle();
    if (!os) throw new Error("Ordem de serviço não encontrada.");

    const { gerarPdfOs } = await import("@/lib/os-pdf.server");
    const modo =
      os.status === "orcamento" || os.status === "aguardando_aprovacao" ? "orcamento" : "os";
    const bytes = await gerarPdfOs({ osId: data.osId, empresaId: os.user_id, modo });
    return { base64: Buffer.from(bytes).toString("base64"), numero: os.numero };
  });
