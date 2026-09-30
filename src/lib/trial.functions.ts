import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enviarEmail } from "@/lib/email";
import { prazoAcesso } from "@/lib/acesso";

// Kept in sync with AVISAR_A_PARTIR_DE in src/components/TrialBanner.tsx.
// O prazo do teste vem de lib/acesso.ts (sem dependência de cliente).
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

    const prazo = prazoAcesso({ plano: "trial", acessoAte: null, criadoEm: profile.created_at });
    if (prazo.tipo !== "teste") return { enviado: false };
    const { diasRestantes } = prazo;
    if (diasRestantes > AVISAR_A_PARTIR_DE) return { enviado: false };

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(empresaId);
    const email = userData?.user?.email;
    if (userError || !email) return { enviado: false };

    const expirado = prazo.expirado;
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
