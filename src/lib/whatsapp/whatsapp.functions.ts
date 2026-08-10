// Authenticated server functions for the WhatsApp screen — same pattern as
// src/lib/ai/chat.functions.ts: createServerFn + requireSupabaseAuth, so the
// empresa is always context.userId from the verified Supabase session, never
// a value the client could send. This file is safe to import from client
// components (it ships a thin RPC stub to the browser bundle); the actual
// Evolution API calls and service-role DB access happen only inside
// whatsapp-service.ts / evolution-api.ts, which never leave the server.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as whatsappService from "./whatsapp-service";
import type { WhatsappConexao, WhatsappMensagem } from "./types";

function origemAtual(): string {
  const request = getRequest();
  return new URL(request.url).origin;
}

export const conectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao> => {
    return whatsappService.conectar(context.userId, origemAtual());
  });

export const statusWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao | null> => {
    return whatsappService.atualizarStatus(context.userId);
  });

export const qrCodeWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ qr: string | null }> => {
    return { qr: await whatsappService.obterQrCodeSalvo(context.userId) };
  });

export const desconectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao | null> => {
    return whatsappService.desconectar(context.userId);
  });

const enviarSchema = z.object({
  numero: z.string().trim().min(8).max(20),
  mensagem: z.string().trim().min(1).max(4096),
});

export const enviarMensagemWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => enviarSchema.parse(data))
  .handler(async ({ data, context }): Promise<WhatsappMensagem> => {
    return whatsappService.enviarMensagem(context.userId, data.numero, data.mensagem);
  });

export const listarMensagensWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappMensagem[]> => {
    return whatsappService.listarMensagensRecentes(context.userId);
  });
