// Server functions for the customer-facing "Minha Conta" area. Same pattern
// as every other *.functions.ts in this project: createServerFn +
// requireSupabaseAuth, so context.userId always comes from the verified
// Supabase session — never from anything the client sends.
//
// These two operations specifically need supabaseAdmin (service role)
// rather than the RLS-scoped client every read in this area uses:
// - vincularContaCliente runs before any clientes row is linked to this
//   account yet, so RLS (which only grants access once linked) can't help.
// - atualizarMeusDados only ever sets a fixed whitelist of columns, keyed
//   by auth_user_id = context.userId — safer here than an RLS UPDATE
//   policy, which can't stop a crafted request from also overwriting
//   user_id (reassigning the row to a different empresa) or auth_user_id.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailDoUsuario, gerarSenhaCliente, usuarioBaseDoNome, usuarioDoEmail } from "./usuario";

// getRequest().url reflects the internal host/port this Node process is
// bound to behind the reverse proxy, not the public https:// domain — using
// it as the magic-link redirect sends the customer to an unreachable
// internal URL. VITE_-prefixed vars in this project are only injected into
// import.meta.env (verified: process.env has none of them at runtime, even
// though client.ts:33 already reads VITE_SUPABASE_URL this same way) — read
// VITE_SITE_URL from there instead of process.env.
function origemPublicaServer(): string {
  return import.meta.env["VITE_SITE_URL"] ?? "";
}

export type VinculoResultado = { clienteId: string; criado: boolean };

// Only used to look up which empresa owns a brand-new customer record when
// no existing clientes row matches by email/telefone. This deployment has
// more than one signed-up empresa (plus a few seed/test accounts sharing
// the exact same created_at as the real one, which made plain "oldest
// profile" resolve non-deterministically), so the SPACE TECH admin account
// is matched by email first; "oldest profile" is only a fallback for a
// deployment where that account doesn't exist. A true multi-tenant
// storefront (customer signup scoped to a specific empresa by
// subdomain/slug) would need this resolved differently.
async function obterEmpresaPadrao(): Promise<string | null> {
  const { data: admin } = await supabaseAdmin.auth.admin.listUsers();
  const contaSpaceTech = admin?.users.find((u) => u.email === "admin@spacetech.app");
  if (contaSpaceTech) return contaSpaceTech.id;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export const vincularContaCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VinculoResultado> => {
    // Already linked (e.g. logging in again) — nothing to do.
    const { data: existenteRaw } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    const existente = existenteRaw as unknown as { id: string } | null;
    if (existente) return { clienteId: existente.id, criado: false };

    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    // signUp()'s options.data ends up nested under the JWT's user_metadata
    // claim, not spread onto the claims object itself.
    const metadata = (context.claims.user_metadata ?? {}) as Record<string, unknown>;
    const telefoneMeta = metadata["telefone"];
    const telefone = typeof telefoneMeta === "string" && telefoneMeta ? telefoneMeta : null;
    const nomeMeta = metadata["nome"] ?? metadata["name"];
    const nome = typeof nomeMeta === "string" && nomeMeta ? nomeMeta : "Cliente";

    // Match an existing staff-created contact by email or phone, claimed on
    // a first-come-first-served basis (auth_user_id IS NULL) so a second
    // signup can't hijack someone else's already-linked record.
    let matchQuery = supabaseAdmin.from("clientes").select("id").is("auth_user_id", null);
    if (email && telefone) {
      matchQuery = matchQuery.or(`email.eq.${email},telefone.eq.${telefone}`);
    } else if (email) {
      matchQuery = matchQuery.eq("email", email);
    } else if (telefone) {
      matchQuery = matchQuery.eq("telefone", telefone);
    } else {
      matchQuery = matchQuery.eq("id", "00000000-0000-0000-0000-000000000000"); // no signal to match on
    }
    const { data: matchRaw } = await matchQuery.limit(1).maybeSingle();
    const match = matchRaw as unknown as { id: string } | null;

    if (match) {
      const { error } = await supabaseAdmin
        .from("clientes")
        .update({ auth_user_id: context.userId })
        .eq("id", match.id);
      if (error) throw error;
      return { clienteId: match.id, criado: false };
    }

    const empresaId = await obterEmpresaPadrao();
    if (!empresaId) throw new Error("Nenhuma empresa configurada para vincular este cliente.");

    const { data: criado, error } = await supabaseAdmin
      .from("clientes")
      .insert({
        user_id: empresaId,
        auth_user_id: context.userId,
        nome,
        email,
        telefone,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { clienteId: (criado as unknown as { id: string }).id, criado: true };
  });

const dadosSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  telefone: z.string().trim().max(20).optional().nullable(),
  documento: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  endereco: z.string().trim().max(300).optional().nullable(),
});

export const atualizarMeusDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => dadosSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await supabaseAdmin
      .from("clientes")
      .update({
        nome: data.nome,
        telefone: data.telefone ?? null,
        documento: data.documento ?? null,
        email: data.email ?? null,
        endereco: data.endereco ?? null,
      })
      .eq("auth_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const gerarAcessoSchema = z.object({ clienteId: z.string().uuid() });

export type AcessoClienteResultado = {
  link: string;
  nome: string;
  telefone: string | null;
  usuario: string;
  senha: string;
  // true when the customer already had a login and this call issued a new password.
  redefinida: boolean;
};

// True only for accounts that are nothing but an Área do Cliente login: no
// empresa profile, no staff membership. Guards the password reset below —
// clientes.auth_user_id is writable by staff through RLS, so without this a
// staff member could point a client row at the empresa owner's auth user
// and have this function hand them a fresh password for it.
async function ehContaSomenteCliente(userId: string): Promise<boolean> {
  const [{ data: user }, perfil, empresa, papel] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin.from("profiles").select("id").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_empresas").select("id").eq("user_id", userId).limit(1).maybeSingle(),
    supabaseAdmin.from("user_roles").select("id").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  return (
    user?.user?.user_metadata?.["account_type"] === "cliente" &&
    !perfil.data &&
    !empresa.data &&
    !papel.data
  );
}

// Staff-side: from a Ordem de Serviço, give the OS's client a username +
// password for the Área do Cliente, to be sent over WhatsApp. The username
// is derived from the registered name ("joao.silva", "joao.silva2" on
// collision). If the client already has a login, its password is replaced
// with a new one (the username/e-mail stays the same).
//
// Deliberately takes a bare clienteId from the client, unlike every other
// write in this file: it's staff (not the customer) calling this, and the
// very first query below is run through context.supabase (RLS-scoped, not
// supabaseAdmin) — RLS's existing has_permission() staff policy on
// `clientes` is what actually authorizes this, so a clienteId belonging to
// a different empresa (or a caller with no staff permission at all)
// resolves to nothing and gets rejected below, same as it would anywhere
// else in the app.
export const gerarAcessoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarAcessoSchema.parse(data))
  .handler(async ({ data, context }): Promise<AcessoClienteResultado> => {
    const { data: clienteRaw, error } = await context.supabase
      .from("clientes")
      .select("id, nome, telefone, auth_user_id")
      .eq("id", data.clienteId)
      .single();
    const cliente = clienteRaw as unknown as {
      id: string;
      nome: string;
      telefone: string | null;
      auth_user_id: string | null;
    } | null;
    if (error || !cliente) {
      throw new Error("Cliente não encontrado ou você não tem permissão para acessá-lo.");
    }

    const origin = origemPublicaServer() || new URL(getRequest().url).origin;
    const link = `${origin}/login?area=cliente`;
    const senha = gerarSenhaCliente();

    if (cliente.auth_user_id) {
      if (!(await ehContaSomenteCliente(cliente.auth_user_id))) {
        throw new Error("O acesso vinculado a este cliente não pode ser redefinido por aqui.");
      }
      const { data: atualizado, error: erroSenha } = await supabaseAdmin.auth.admin.updateUserById(
        cliente.auth_user_id,
        {
          password: senha,
          email_confirm: true,
        },
      );
      if (erroSenha || !atualizado?.user?.email) {
        throw new Error(erroSenha?.message ?? "Não foi possível redefinir a senha do cliente.");
      }
      const email = atualizado.user.email;
      return {
        link,
        nome: cliente.nome,
        telefone: cliente.telefone,
        usuario: usuarioDoEmail(email) ?? email,
        senha,
        redefinida: true,
      };
    }

    const base = usuarioBaseDoNome(cliente.nome);
    for (let n = 1; n <= 50; n++) {
      const usuario = n === 1 ? base : `${base}${n}`;
      const { data: criado, error: erroCriar } = await supabaseAdmin.auth.admin.createUser({
        email: emailDoUsuario(usuario),
        password: senha,
        email_confirm: true,
        user_metadata: {
          account_type: "cliente",
          nome: cliente.nome,
          telefone: cliente.telefone,
          usuario,
        },
      });
      if (erroCriar) {
        if (erroCriar.code === "email_exists" || /already|registered/i.test(erroCriar.message)) {
          continue;
        }
        throw new Error(erroCriar.message);
      }

      const { data: vinculado } = await supabaseAdmin
        .from("clientes")
        .update({ auth_user_id: criado.user.id })
        .eq("id", cliente.id)
        .is("auth_user_id", null) // lost a race with another "gerar acesso" click
        .select("id");
      if (!vinculado?.length) {
        await supabaseAdmin.auth.admin.deleteUser(criado.user.id);
        throw new Error("Este cliente acabou de receber um acesso. Tente novamente.");
      }
      return {
        link,
        nome: cliente.nome,
        telefone: cliente.telefone,
        usuario,
        senha,
        redefinida: false,
      };
    }
    throw new Error("Não foi possível gerar um nome de usuário livre para este cliente.");
  });
