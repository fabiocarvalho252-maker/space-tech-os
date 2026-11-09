// /admin/marketing — leitura e decisão (aprovar/recusar), só para o administrador do site
// (mesmo e-mail fixo do /admin; conferido aqui no servidor, não só na tela).
// Aprovar/recusar: um conteúdo por vez, com as plataformas marcadas pelo dono;
// publicar continua fora do sistema, por ordem explícita do dono
// (ver marketing/README.md).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import type { MarketingAdmin } from "./leitura.server";

export type { MarketingAdmin, DocumentoMarketing } from "./leitura.server";

export const obterMarketingAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MarketingAdmin> => {
    checarSiteAdmin(context.claims);
    const { lerMarketing } = await import("./leitura.server");
    return lerMarketing();
  });

const decisaoSchema = z
  .object({
    id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
    acao: z.enum(["aprovar", "recusar"]),
    plataformas: z.array(z.string().trim().min(1).max(80)).max(8),
    motivo: z.string().max(500).default(""),
    versao: z.string().min(10).max(40),
  })
  .refine((d) => d.acao === "recusar" || d.plataformas.length > 0, {
    message: "Marque ao menos uma plataforma.",
  });

// Aprova (com as plataformas marcadas) ou recusa UM conteúdo. Não publica.
export const decidirConteudoMarketing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => decisaoSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ status: "APROVADO" | "RASCUNHO" }> => {
    checarSiteAdmin(context.claims);
    const { decidirConteudo } = await import("./decisao.server");
    return decidirConteudo({ ...data, email: String(context.claims["email"] ?? "") });
  });
