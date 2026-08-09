import { createServerFn } from "@tanstack/react-start";
import { differenceInCalendarDays } from "date-fns";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enviarEmail } from "@/lib/email";

// Kept in sync with DIAS_TESTE / AVISAR_A_PARTIR_DE in src/hooks/useCurrentUser.ts
// and src/components/TrialBanner.tsx — duplicated rather than imported because
// those are client hook modules and this runs server-only.
const DIAS_TESTE = 7;
const AVISAR_A_PARTIR_DE = 3;

/**
 * Sends the "trial ending" email for the caller's company, at most once ever
 * (tracked via profiles.trial_aviso_enviado_em). No-op outside the warning
 * window, if already sent, or if SMTP isn't configured.
 */
export const avisarTrialPorEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: memberships } = await supabaseAdmin
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", context.userId);
    if (!memberships?.length) return { enviado: false };
    const empresaId =
      memberships.find((m) => m.empresa_id !== context.userId)?.empresa_id ??
      memberships[0]!.empresa_id;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("created_at, trial_aviso_enviado_em")
      .eq("id", empresaId)
      .maybeSingle();
    if (!profile?.created_at || profile.trial_aviso_enviado_em) return { enviado: false };

    const diasDecorridos = differenceInCalendarDays(new Date(), new Date(profile.created_at));
    const diasRestantes = DIAS_TESTE - diasDecorridos;
    if (diasRestantes > AVISAR_A_PARTIR_DE) return { enviado: false };

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(empresaId);
    const email = userData?.user?.email;
    if (userError || !email) return { enviado: false };

    const expirado = diasRestantes < 0;
    const mensagem = expirado
      ? "Seu período de teste grátis do SpaceTech expirou. Fale com a gente para continuar usando o sistema."
      : `Seu período de teste grátis do SpaceTech termina em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}. Ative um plano para não perder o acesso.`;

    const resultado = await enviarEmail({
      to: email,
      subject: expirado
        ? "Seu teste grátis do SpaceTech expirou"
        : "Seu teste grátis do SpaceTech está terminando",
      text: mensagem,
      html: `<p>${mensagem}</p>`,
    });
    if (!resultado.ok) return { enviado: false };

    await supabaseAdmin
      .from("profiles")
      .update({ trial_aviso_enviado_em: new Date().toISOString() })
      .eq("id", empresaId);

    return { enviado: true };
  });
