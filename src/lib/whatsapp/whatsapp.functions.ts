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

const anexosSchema = z.object({ os: z.boolean(), orcamento: z.boolean() });
const agendamentoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("agora") }),
  z.object({ tipo: z.literal("fila"), scheduledAt: z.string().datetime() }),
]);

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
  .validator((data: unknown) => enviarSchema.parse(data))
  .handler(async ({ data, context }): Promise<WhatsappMensagem> => {
    return whatsappService.enviarMensagem(context.userId, data.numero, data.mensagem);
  });

export const listarMensagensWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappMensagem[]> => {
    return whatsappService.listarMensagensRecentes(context.userId);
  });

const notificacaoOsSchema = z.object({
  osId: z.string().uuid(),
  numero: z.string().trim().min(8).max(20),
  mensagem: z.string().trim().max(4096),
  templateId: z.string().nullable(),
  anexos: anexosSchema,
  agendamento: agendamentoSchema,
});

// Behind "Enviar notificação por WhatsApp" in the OS faturamento/notification
// modal. context.userId doubles as both the empresa scope (matches every
// other table) and, for scheduled sends, the "sent_by" attribution.
export const enviarNotificacaoOsWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => notificacaoOsSchema.parse(data))
  .handler(async ({ data, context }): Promise<WhatsappMensagem> => {
    return whatsappService.enviarNotificacaoOs({
      userId: context.userId,
      osId: data.osId,
      numero: data.numero,
      mensagem: data.mensagem,
      templateId: data.templateId,
      anexos: data.anexos,
      agendamento: data.agendamento,
      sentBy: context.userId,
    });
  });

// Opportunistic "queue worker" — there is no cron in this project, so this
// is called once when Ordens de Serviço loads (see ordens.tsx) to flush any
// notification whose scheduled_at has already passed.
export const processarNotificacoesAgendadasWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ processadas: number }> => {
    const processadas = await whatsappService.processarNotificacoesAgendadasOs(context.userId);
    return { processadas };
  });
