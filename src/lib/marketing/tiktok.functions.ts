// Conta do TikTok e envio de vídeos do /admin/marketing — só para o
// administrador do site (checarSiteAdmin no servidor). Envio só pelo botão
// "Enviar ao TikTok", com confirmação, um conteúdo por vez.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import type { ContasTikTokPublico, InfoCriadorTikTok } from "./tiktok.server";

export type { ContasTikTokPublico, InfoCriadorTikTok } from "./tiktok.server";

export const obterContaTikTok = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContasTikTokPublico> => {
    checarSiteAdmin(context.claims);
    const t = await import("./tiktok.server");
    return t.contasTikTokPublico();
  });

export const iniciarConexaoTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    checarSiteAdmin(context.claims);
    const t = await import("./tiktok.server");
    return { url: t.urlConexaoTikTok() };
  });

export const desconectarTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const t = await import("./tiktok.server");
    await t.desconectarTikTok();
    return { ok: true };
  });

export const obterCriadorTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InfoCriadorTikTok> => {
    checarSiteAdmin(context.claims);
    const t = await import("./tiktok.server");
    return t.infoCriadorTikTok();
  });

export const enviarTikTok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
        modo: z.enum(["rascunho", "direto"]),
        versao: z.string().min(10).max(40),
        opcoes: z
          .object({
            privacidade: z.string().regex(/^[A-Z_]{3,40}$/),
            permitirComentario: z.boolean(),
            permitirDueto: z.boolean(),
            permitirCostura: z.boolean(),
            marcaPropria: z.boolean(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ link: string | null }> => {
    checarSiteAdmin(context.claims);
    const { enviarConteudoTikTok } = await import("./publicacao.server");
    return enviarConteudoTikTok({ ...data, email: String(context.claims["email"] ?? "") });
  });
