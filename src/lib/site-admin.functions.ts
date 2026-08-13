import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  atualizarStatusSistema,
  conectarSistema,
  desconectarSistema,
  obterStatusSistemaSalvo,
  type WhatsappSistemaConexao,
} from "@/lib/whatsapp/system-instance";

// Hardcoded on purpose: this is a single-operator platform-wide view (every
// empresa that has ever signed up, across every tenant), not a permission a
// company admin can be granted — there is no "site owner" role/flag in the
// schema, and adding one just for a single person isn't worth the surface
// area. Authorization is enforced here, server-side, not by hiding a link.
const SITE_ADMIN_EMAIL = "admin@spacetech.app";

function checarSiteAdmin(claims: Record<string, unknown>) {
  if (claims["email"] !== SITE_ADMIN_EMAIL) {
    throw new Error("Acesso restrito ao administrador do site.");
  }
}

export type EmpresaDoSite = {
  id: string;
  nome: string | null;
  loja: string | null;
  email: string | null;
  whatsapp: string | null;
  cnpjCpf: string | null;
  endereco: string | null;
  cidade: string | null;
  criadoEm: string;
  ultimoLogin: string | null;
  totalOrdens: number;
  totalMembros: number;
  plano: string;
  acessoAte: string | null;
};

export const listarEmpresasDoSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ empresas: EmpresaDoSite[] }> => {
    checarSiteAdmin(context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: empresas, error: empresasErro } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, loja, whatsapp, cnpj_cpf, endereco, cidade, created_at, plano, acesso_ate")
      .order("created_at", { ascending: false });
    if (empresasErro) throw empresasErro;
    if (!empresas?.length) return { empresas: [] };

    const ids = empresas.map((e) => e.id);

    const [{ data: usersPage, error: usersErro }, { data: ordens }, { data: membros }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
        supabaseAdmin.from("ordens_servico").select("user_id").in("user_id", ids),
        supabaseAdmin.from("user_empresas").select("empresa_id").in("empresa_id", ids),
      ]);
    if (usersErro) throw usersErro;

    const porId = new Map(usersPage.users.map((u) => [u.id, u]));
    const totalOrdensPorEmpresa = new Map<string, number>();
    for (const o of ordens ?? []) {
      totalOrdensPorEmpresa.set(o.user_id, (totalOrdensPorEmpresa.get(o.user_id) ?? 0) + 1);
    }
    const totalMembrosPorEmpresa = new Map<string, number>();
    for (const m of membros ?? []) {
      totalMembrosPorEmpresa.set(m.empresa_id, (totalMembrosPorEmpresa.get(m.empresa_id) ?? 0) + 1);
    }

    return {
      empresas: empresas.map((e) => {
        const u = porId.get(e.id);
        return {
          id: e.id,
          nome: e.nome,
          loja: e.loja,
          email: u?.email ?? null,
          whatsapp: e.whatsapp,
          cnpjCpf: e.cnpj_cpf,
          endereco: e.endereco,
          cidade: e.cidade,
          criadoEm: e.created_at,
          ultimoLogin: u?.last_sign_in_at ?? null,
          totalOrdens: totalOrdensPorEmpresa.get(e.id) ?? 0,
          totalMembros: totalMembrosPorEmpresa.get(e.id) ?? 0,
          plano: e.plano,
          acessoAte: e.acesso_ate,
        };
      }),
    };
  });

const PLANOS_COM_VALIDADE = ["mensal", "trimestral", "semestral", "anual"] as const;

const planoSchema = z.object({
  empresaId: z.string().uuid(),
  plano: z.enum(["trial", "mensal", "trimestral", "semestral", "anual", "vitalicio", "suspenso"]),
  acessoAte: z.string().nullable(),
});

export const atualizarPlanoEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => planoSchema.parse(data))
  .handler(async ({ data, context }) => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plano: data.plano,
        acesso_ate: (PLANOS_COM_VALIDADE as readonly string[]).includes(data.plano)
          ? data.acessoAte
          : null,
      })
      .eq("id", data.empresaId);
    if (error) throw error;
  });

function gerarSenhaAleatoria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let senha = "";
  for (let i = 0; i < 12; i++) senha += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return senha;
}

export const resetarSenhaEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ senha: string }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const senha = gerarSenhaAleatoria();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.empresaId, {
      password: senha,
    });
    if (error) throw error;
    return { senha };
  });

// "Entrar no painel" from /admin — reuses the exact same passwordless
// mechanism as gerarAcessoCliente (src/lib/cliente-conta/cliente-conta.functions.ts):
// an admin-generated Supabase magic link, never emailed, just handed back to
// the caller to navigate to directly. Unlike resetarSenhaEmpresa, this never
// touches the empresa's own password — it's the site admin borrowing a
// session, not changing how the empresa logs in.
export const entrarComoEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ empresaId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ link: string }> => {
    checarSiteAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: userData, error: userErro } = await supabaseAdmin.auth.admin.getUserById(
      data.empresaId,
    );
    if (userErro || !userData?.user?.email) {
      throw new Error("Esta empresa não tem um e-mail de login válido.");
    }

    const origin = new URL(getRequest().url).origin;
    const { data: gerado, error: erroLink } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
      options: { redirectTo: `${origin}/dashboard` },
    });
    if (erroLink || !gerado?.properties?.action_link) {
      throw new Error(erroLink?.message ?? "Não foi possível gerar o acesso a essa empresa.");
    }

    return { link: gerado.properties.action_link };
  });

// The platform-wide "spacetech_system" WhatsApp instance that sends
// activation codes for every empresa signup (see
// src/lib/auth/ativacao-whatsapp.functions.ts) — paired once by the SPACE
// TECH operator from this screen, distinct from each empresa's own
// WhatsApp connection at /whatsapp.
export const conectarWhatsappSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappSistemaConexao> => {
    checarSiteAdmin(context.claims);
    const origin = new URL(getRequest().url).origin;
    return conectarSistema(origin);
  });

export const statusWhatsappSistema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappSistemaConexao | null> => {
    checarSiteAdmin(context.claims);
    const existente = await obterStatusSistemaSalvo();
    if (!existente) return null;
    if (existente.status === "conectado") return existente;
    return atualizarStatusSistema();
  });

export const desconectarWhatsappSistema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappSistemaConexao | null> => {
    checarSiteAdmin(context.claims);
    return desconectarSistema();
  });
