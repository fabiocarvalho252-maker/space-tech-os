// Server function behind the "Planos" page (/assinatura). SPACE TECH has no
// payment gateway of its own yet, so this doesn't charge anyone — it just
// records which plano the empresa wants, for the site admin to see and
// activate manually from /admin (see atualizarPlanoEmpresa, which clears
// this once handled).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLANOS_SOLICITAVEIS = ["mensal", "anual", "vitalicio"] as const;

const schema = z.object({ plano: z.enum(PLANOS_SOLICITAVEIS) });

const NOME_PLANO: Record<string, string> = {
  trial: "Teste grátis",
  mensal: "Mensal",
  anual: "Anual",
  vitalicio: "Vitalício",
  suspenso: "Suspenso",
};

export const solicitarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Same "outside membership wins over self-ownership" resolution as
    // useMinhaEmpresa/route.tsx's trial gate — an invited team member's
    // request should land on the empresa they work for, not a placeholder
    // self-row that was never actually signed up for a plan.
    const { data: membership } = await supabaseAdmin
      .from("user_empresas")
      .select("empresa_id")
      .eq("user_id", context.userId);
    const empresaId =
      membership?.find((m) => m.empresa_id !== context.userId)?.empresa_id ??
      membership?.[0]?.empresa_id ??
      context.userId;

    const { data: perfil, error } = await supabaseAdmin
      .from("profiles")
      .update({ plano_solicitado: data.plano, plano_solicitado_em: new Date().toISOString() })
      .eq("id", empresaId)
      .select("loja, nome, plano, acesso_ate")
      .single();
    if (error) throw error;

    // Avisa o dono da plataforma no WhatsApp para aprovar no /admin.
    const pago = ["mensal", "anual", "vitalicio"].includes(perfil.plano);
    const ate = perfil.acesso_ate
      ? ` até ${new Date(perfil.acesso_ate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
      : "";
    const { avisarDonoDaPlataforma } = await import("@/lib/whatsapp/whatsapp-service");
    await avisarDonoDaPlataforma(
      `aviso_plano_pedido_${empresaId}_${Date.now()}`,
      [
        `🆕 *${pago ? "Pedido de renovação" : "Pedido de plano"}* — ${perfil.loja || perfil.nome || "Loja sem nome"}`,
        `Pediu: plano ${NOME_PLANO[data.plano]}`,
        `Plano atual: ${NOME_PLANO[perfil.plano] ?? perfil.plano}${ate}`,
        "",
        `Aprovar no painel: ${import.meta.env["VITE_SITE_URL"] ?? ""}/admin`,
      ].join("\n"),
    );
    return { ok: true };
  });
