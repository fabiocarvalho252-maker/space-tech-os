// Contas (Meta) e publicação do /admin/marketing — tudo só para o
// administrador do site (checarSiteAdmin no servidor). Publicar só acontece
// pelo botão "Publicar", com confirmação, um conteúdo e uma plataforma por vez.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import type { ContasMetaPublico } from "./meta.server";

export type { ContasMetaPublico } from "./meta.server";

export const obterContasMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContasMetaPublico> => {
    checarSiteAdmin(context.claims);
    const m = await import("./meta.server");
    return m.contasPublico(await m.lerContas());
  });

export const iniciarConexaoMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    checarSiteAdmin(context.claims);
    const m = await import("./meta.server");
    return { url: m.urlConexao() };
  });

export const escolherPaginaMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ paginaId: z.string().regex(/^\d{1,30}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const m = await import("./meta.server");
    await m.escolherPagina(data.paginaId);
    return { ok: true };
  });

export const desconectarMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const m = await import("./meta.server");
    await m.desconectar();
    return { ok: true };
  });

export const publicarConteudoMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
        plataforma: z.enum(["instagram", "facebook"]),
        versao: z.string().min(10).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ link: string }> => {
    checarSiteAdmin(context.claims);
    const { publicarConteudo } = await import("./publicacao.server");
    return publicarConteudo({ ...data, email: String(context.claims["email"] ?? "") });
  });
