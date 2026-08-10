import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { redirect } from "@tanstack/react-router";
import { DIAS_TESTE } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw redirect({ to: "/" });
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
      .select("created_at")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaProfile?.created_at) {
      const diasDecorridos = Math.floor(
        (Date.now() - new Date(empresaProfile.created_at).getTime()) / 86_400_000,
      );
      if (diasDecorridos > DIAS_TESTE) throw redirect({ to: "/assinatura" });
    }

    return { user };
  },
  component: AppShell,
});
