// Server functions for empresa signups at /cadastro (Área do Cliente is
// untouched). WhatsApp-OTP account activation (enviarCodigoAtivacao /
// verificarCodigoAtivacao) was removed in 20260814160000_remover_ativacao_whatsapp
// — the platform's system WhatsApp instance kept going offline, which left
// every new signup stuck unable to activate. Empresa accounts activate
// immediately again; only the pre-signup WhatsApp-uniqueness check remains.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizarWhatsappBR } from "@/lib/whatsapp";

const disponibilidadeSchema = z.object({ whatsapp: z.string().trim().min(8).max(20) });

/**
 * Pre-flight duplicate check called right before supabase.auth.signUp() so
 * /cadastro can show "Este WhatsApp já está vinculado a uma conta." instead
 * of whatever generic error a unique-constraint violation surfaces from
 * inside the handle_new_user() trigger (which still exists as a backstop
 * for the race between this check and the real signup). No auth required —
 * there's no session yet at this point in the flow — and the response is a
 * bare boolean to avoid leaking anything beyond "taken or not".
 */
export const verificarWhatsappDisponivel = createServerFn({ method: "POST" })
  .validator((data: unknown) => disponibilidadeSchema.parse(data))
  .handler(async ({ data }): Promise<{ disponivel: boolean }> => {
    const normalizado = normalizarWhatsappBR(data.whatsapp);
    const { data: existente } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("whatsapp", normalizado)
      .maybeSingle();
    return { disponivel: !existente };
  });

/**
 * Avisa o dono da plataforma no WhatsApp que uma empresa acabou de se
 * cadastrar. Chamado por /cadastro logo depois do signUp. Só vale para
 * contas criadas há poucos minutos e uma vez por conta, para não virar um
 * jeito de mandar mensagem ao dono. Nunca lança.
 */
export const avisarNovoCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    try {
      const { data: perfil } = await supabaseAdmin
        .from("profiles")
        .select("nome, loja, whatsapp, cidade, created_at")
        .eq("id", context.userId)
        .maybeSingle();
      if (!perfil) return { ok: true };
      if (Date.now() - new Date(perfil.created_at).getTime() > 30 * 60 * 1000) return { ok: true };

      const templateId = `aviso_novo_cadastro_${context.userId}`;
      const { data: jaAvisado } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("id")
        .eq("template_id", templateId)
        .limit(1);
      if (jaAvisado?.length) return { ok: true };

      const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const { avisarDonoDaPlataforma } = await import("@/lib/whatsapp/whatsapp-service");
      await avisarDonoDaPlataforma(
        templateId,
        [
          `🎉 *Nova empresa cadastrada* — ${perfil.loja || "Loja sem nome"}`,
          `Responsável: ${perfil.nome || "-"}`,
          `WhatsApp: ${perfil.whatsapp || "-"}`,
          `Email: ${usuario?.user?.email || "-"}`,
          ...(perfil.cidade ? [`Cidade: ${perfil.cidade}`] : []),
          "Plano: Teste grátis (7 dias)",
          "",
          `Ver no painel: ${import.meta.env["VITE_SITE_URL"] ?? ""}/admin`,
        ].join("\n"),
      );
    } catch (erro) {
      console.error("[Aviso plataforma] Erro no aviso de novo cadastro:", erro);
    }
    return { ok: true };
  });
