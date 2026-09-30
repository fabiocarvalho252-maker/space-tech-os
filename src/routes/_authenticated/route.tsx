import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { redirect } from "@tanstack/react-router";
import { prazoAcesso } from "@/lib/acesso";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw redirect({ to: "/login" });
    const user = data.session.user;

    // Trial gate: the company's own profile.created_at is the trial's start,
    // whether the caller is the owner or an invited team member — the whole
    // company loses access together once it expires (see /assinatura).
    const { data: membership } = await supabase
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", user.id);
    const empresaId =
      membership?.find((m) => m.empresa_id !== user.id)?.empresa_id ??
      membership?.[0]?.empresa_id ??
      user.id;

    const { data: empresaProfile } = await supabase
      .from("profiles")
      .select("created_at, plano, acesso_ate")
      .eq("id", empresaId)
      .maybeSingle();

    // plano is set by the site admin (/admin) — defaults to "trial" for
    // every signup, so nothing changes here unless explicitly granted.
    // Regra de prazo em lib/acesso.ts (mesma do painel /admin).
    const prazo = prazoAcesso({
      plano: empresaProfile?.plano,
      acessoAte: empresaProfile?.acesso_ate,
      criadoEm: empresaProfile?.created_at,
    });
    if (prazo.tipo === "suspenso" || (prazo.tipo !== "sem_vencimento" && prazo.expirado)) {
      throw redirect({ to: "/assinatura" });
    }

    return { user };
  },
  component: AppShell,
});
