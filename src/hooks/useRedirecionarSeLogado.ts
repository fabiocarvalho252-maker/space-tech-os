import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { vincularContaCliente } from "@/lib/cliente-conta/cliente-conta.functions";

// Whether the given uid is a linked customer (Área do Cliente) rather than
// staff, so each lands on the right home screen. Safe to call for a staff
// session too: the RLS customer policy only ever returns their own row, so
// a staff uid (never linked as auth_user_id) just gets null.
async function ehClienteVinculado(uid: string): Promise<boolean> {
  const { data } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
    .from("clientes" as any)
    .select("id")
    .eq("auth_user_id", uid)
    .maybeSingle();
  return !!data;
}

/**
 * Quem já tem sessão e abre a landing (/) ou o login (/login) vai direto
 * para o painel: /dashboard para a equipe, /minha-conta para cliente.
 * Também cobre a volta do link de confirmação de e-mail do cadastro, que
 * cai em / (emailRedirectTo = origemPublica()).
 * `ativo = false` desliga (prévia da landing aberta pelo admin).
 */
export function useRedirecionarSeLogado(ativo = true) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!ativo) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const user = data.session.user;
      // Coming back from confirming a customer signup email: the link
      // to `clientes` only ever gets created by vincularContaCliente(),
      // which the signup form only calls when signUp() already returns a
      // session (email confirmation disabled) — a confirmed-by-email
      // session never went through that, so it's done here instead.
      if (user.user_metadata?.["account_type"] === "cliente") {
        try {
          await vincularContaCliente();
        } catch {
          // best-effort — /minha-conta's own guard retries this
        }
        navigate({ to: "/minha-conta", replace: true });
        return;
      }
      const destino = (await ehClienteVinculado(user.id)) ? "/minha-conta" : "/dashboard";
      navigate({ to: destino, replace: true });
    });
  }, [navigate, ativo]);
}
