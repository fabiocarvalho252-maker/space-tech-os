// /admin/marketing — somente leitura e somente para o administrador do site
// (mesmo e-mail fixo do /admin; conferido aqui no servidor, não só na tela).
// Aprovar e publicar continuam fora do sistema, por ordem explícita do dono
// (ver marketing/README.md).
import { createServerFn } from "@tanstack/react-start";
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
