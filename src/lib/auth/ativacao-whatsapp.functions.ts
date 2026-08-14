// Server functions for empresa signups at /cadastro (Área do Cliente is
// untouched). WhatsApp-OTP account activation (enviarCodigoAtivacao /
// verificarCodigoAtivacao) was removed in 20260814160000_remover_ativacao_whatsapp
// — the platform's system WhatsApp instance kept going offline, which left
// every new signup stuck unable to activate. Empresa accounts activate
// immediately again; only the pre-signup WhatsApp-uniqueness check remains.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
