// Server functions for WhatsApp-based account activation (empresa signups
// at /cadastro only — Área do Cliente is untouched, see the migration).
// Same createServerFn + requireSupabaseAuth pattern as every other
// *.functions.ts in this project. OTP codes are never stored in plain text
// (only a salted sha256 hash) and never returned to the client.
import { randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mascararWhatsappBR, normalizarWhatsappBR } from "@/lib/whatsapp";
import {
  WhatsappSistemaNaoConfiguradoError,
  enviarMensagemSistema,
} from "@/lib/whatsapp/system-instance";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

type OtpRow = {
  id: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  verified_at: string | null;
  created_at: string;
};

function gerarCodigo(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashCodigo(codigo: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${codigo}`).digest("hex");
}

function codigosIguais(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function ultimoOtp(userId: string): Promise<OtpRow | null> {
  const { data, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
    .from("whatsapp_otps" as any)
    .select("id, code_hash, attempts, expires_at, verified_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as OtpRow | null) ?? null;
}

export type EnviarCodigoResultado = {
  enviado: boolean;
  cooldownSegundos: number;
  whatsappMascarado: string;
};

/**
 * Generates and sends a fresh activation OTP — used both for the first send
 * right after signup and for "Reenviar código" (same cooldown-checked
 * operation either way, no separate resend endpoint needed). The most
 * recent row is always what verificarCodigoAtivacao checks, so issuing a new
 * one implicitly invalidates whatever code was sent before it.
 */
export const enviarCodigoAtivacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnviarCodigoResultado> => {
    const { data: perfil, error: erroPerfil } = await context.supabase
      .from("profiles")
      .select("status, whatsapp")
      .eq("id", context.userId)
      .single();
    if (erroPerfil || !perfil) throw new Error("Conta não encontrada.");
    if (perfil.status === "active") {
      throw new Error("Esta conta já está ativada.");
    }
    if (!perfil.whatsapp) {
      throw new Error("Nenhum WhatsApp cadastrado para esta conta.");
    }

    const anterior = await ultimoOtp(context.userId);
    if (anterior) {
      const decorridoMs = Date.now() - new Date(anterior.created_at).getTime();
      if (decorridoMs < RESEND_COOLDOWN_MS) {
        return {
          enviado: false,
          cooldownSegundos: Math.ceil((RESEND_COOLDOWN_MS - decorridoMs) / 1000),
          whatsappMascarado: mascararWhatsappBR(perfil.whatsapp),
        };
      }
    }

    const codigo = gerarCodigo();
    const salt = randomBytes(16).toString("hex");
    const { data: novo, error: erroInsercao } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
      .from("whatsapp_otps" as any)
      .insert({
        user_id: context.userId,
        code_hash: `${salt}:${hashCodigo(codigo, salt)}`,
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    if (erroInsercao || !novo) throw new Error("Não foi possível gerar o código de ativação.");

    const mensagem = `SPACE TECH OS\n\nSeu código de ativação da conta é: *${codigo}*\n\nEste código é válido por 5 minutos.\n\nSe você não solicitou este cadastro, ignore esta mensagem.`;

    try {
      await enviarMensagemSistema(perfil.whatsapp, mensagem);
    } catch (e) {
      // Roll back the OTP row — nothing was actually delivered, so it must
      // not be checkable by verificarCodigoAtivacao.
      await supabaseAdmin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
        .from("whatsapp_otps" as any)
        .delete()
        .eq("id", (novo as unknown as { id: string }).id);
      if (e instanceof WhatsappSistemaNaoConfiguradoError) throw e;
      console.error(
        "Falha ao enviar código de ativação via WhatsApp:",
        e instanceof Error ? e.message : e,
      );
      throw new Error(
        "Não foi possível enviar o código pelo WhatsApp. Tente novamente em alguns instantes.",
      );
    }

    return {
      enviado: true,
      cooldownSegundos: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      whatsappMascarado: mascararWhatsappBR(perfil.whatsapp),
    };
  });

const verificarSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Código inválido"),
});

export type VerificarCodigoResultado = { ok: true; jaAtiva: boolean };

export const verificarCodigoAtivacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => verificarSchema.parse(data))
  .handler(async ({ data, context }): Promise<VerificarCodigoResultado> => {
    const { data: perfil, error: erroPerfil } = await context.supabase
      .from("profiles")
      .select("status")
      .eq("id", context.userId)
      .single();
    if (erroPerfil || !perfil) throw new Error("Conta não encontrada.");
    if (perfil.status === "active") return { ok: true, jaAtiva: true };

    const otp = await ultimoOtp(context.userId);
    if (!otp || otp.verified_at) {
      throw new Error("Nenhum código pendente. Solicite um novo código.");
    }
    if (new Date(otp.expires_at) < new Date()) {
      throw new Error("Este código expirou. Solicite um novo código.");
    }
    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new Error("Número máximo de tentativas atingido. Solicite um novo código.");
    }

    const [salt, hashEsperado] = otp.code_hash.split(":");
    const confere =
      !!salt && !!hashEsperado && codigosIguais(hashCodigo(data.code, salt), hashEsperado);

    if (!confere) {
      await supabaseAdmin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
        .from("whatsapp_otps" as any)
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      throw new Error("Código inválido. Confira os números enviados para seu WhatsApp.");
    }

    await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet
      .from("whatsapp_otps" as any)
      .update({ verified_at: new Date().toISOString() })
      .eq("id", otp.id);

    const { error: erroAtivacao } = await context.supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", context.userId);
    if (erroAtivacao) throw new Error("Não foi possível ativar a conta. Tente novamente.");

    return { ok: true, jaAtiva: false };
  });

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
