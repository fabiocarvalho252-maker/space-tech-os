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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
      .from("clientes" as any)
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
    let matchQuery = supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
      .from("clientes" as any)
      .select("id")
      .is("auth_user_id", null);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
        .from("clientes" as any)
        .update({ auth_user_id: context.userId })
        .eq("id", match.id);
      if (error) throw error;
      return { clienteId: match.id, criado: false };
    }

    const empresaId = await obterEmpresaPadrao();
    if (!empresaId) throw new Error("Nenhuma empresa configurada para vincular este cliente.");

    const { data: criado, error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
      .from("clientes" as any)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
      .from("clientes" as any)
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

export type AcessoClienteResultado = { link: string; nome: string; telefone: string | null };

// Staff-side "quick login" — from a Ordem de Serviço, generate a one-click
// link into the Área do Cliente for that OS's client, skipping the normal
// self-signup/email-confirmation flow entirely. Deliberately takes a bare
// clienteId from the client, unlike every other write in this file: it's
// staff (not the customer) calling this, and the very first query below is
// run through context.supabase (RLS-scoped, not supabaseAdmin) — RLS's
// existing has_permission() staff policy on `clientes` is what actually
// authorizes this, so a clienteId belonging to a different empresa (or a
// caller with no staff permission at all) resolves to nothing and gets
// rejected below, same as it would anywhere else in the app.
export const gerarAcessoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => gerarAcessoSchema.parse(data))
  .handler(async ({ data, context }): Promise<AcessoClienteResultado> => {
    const { data: cliente, error } = await context.supabase
      .from("clientes")
      .select("id, nome, email, telefone")
      .eq("id", data.clienteId)
      .single();
    if (error || !cliente) {
      throw new Error("Cliente não encontrado ou você não tem permissão para acessá-lo.");
    }
    if (!cliente.email) {
      throw new Error("Cadastre um e-mail para este cliente antes de gerar o acesso.");
    }

    const origin = origemPublicaServer() || new URL(getRequest().url).origin;
    const { data: gerado, error: erroLink } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: cliente.email,
      options: {
        redirectTo: `${origin}/minha-conta`,
        data: { account_type: "cliente", nome: cliente.nome },
      },
    });
    if (erroLink || !gerado?.user) {
      throw new Error(erroLink?.message ?? "Não foi possível gerar o acesso do cliente.");
    }

    await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
      .from("clientes" as any)
      .update({ auth_user_id: gerado.user.id })
      .eq("id", cliente.id)
      .is("auth_user_id", null); // don't clobber an account the customer already controls

    return { link: gerado.properties.action_link, nome: cliente.nome, telefone: cliente.telefone };
  });
