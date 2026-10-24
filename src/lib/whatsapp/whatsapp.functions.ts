// Authenticated server functions for the WhatsApp screen — same pattern as
// src/lib/ai/chat.functions.ts: createServerFn + requireSupabaseAuth, so the
// empresa always comes from the verified Supabase session (empresaDoUsuario),
// never a value the client could send. This file is safe to import from client
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

type Ctx = { supabase: any; userId: string };

// Empresa em que o login trabalha — a mesma regra de useMinhaEmpresa: um
// convite para outra empresa vence a empresa própria (vazia) do funcionário.
// Sem isso, funcionário convidado conectava/enviava pela própria conta.
// Com `modulo`, exige a permissão (has_permission) nessa empresa.
async function empresaDoUsuario(
  context: Ctx,
  modulo?: string,
  acao: "ver" | "gerenciar" = "ver",
): Promise<string> {
  const { data } = await context.supabase
    .from("user_empresas")
    .select("empresa_id")
    .eq("user_id", context.userId);
  const ids: string[] = (data ?? []).map((m: { empresa_id: string }) => m.empresa_id);
  const empresaId = ids.find((id) => id !== context.userId) ?? context.userId;
  if (modulo) {
    const { data: pode } = await context.supabase.rpc("has_permission", {
      p_empresa_id: empresaId,
      p_modulo: modulo,
      p_acao: acao,
    });
    if (!pode) throw new Error("Seu usuário não tem permissão para isso no WhatsApp.");
  }
  return empresaId;
}

export const conectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao> => {
    return whatsappService.conectar(
      await empresaDoUsuario(context, "configuracoes", "gerenciar"),
      origemAtual(),
    );
  });

export const statusWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao | null> => {
    return whatsappService.atualizarStatus(await empresaDoUsuario(context));
  });

export const qrCodeWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ qr: string | null }> => {
    return {
      qr: await whatsappService.obterQrCodeSalvo(
        await empresaDoUsuario(context, "configuracoes", "gerenciar"),
      ),
    };
  });

export const desconectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao | null> => {
    return whatsappService.desconectar(
      await empresaDoUsuario(context, "configuracoes", "gerenciar"),
    );
  });

const enviarSchema = z.object({
  numero: z.string().trim().min(8).max(20),
  mensagem: z.string().trim().min(1).max(4096),
});

export const enviarMensagemWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => enviarSchema.parse(data))
  .handler(async ({ data, context }): Promise<WhatsappMensagem> => {
    return whatsappService.enviarMensagem(
      await empresaDoUsuario(context, "clientes"),
      data.numero,
      data.mensagem,
    );
  });

export const listarMensagensWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappMensagem[]> => {
    return whatsappService.listarMensagensRecentes(await empresaDoUsuario(context, "clientes"));
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
// modal. The empresa scopes the OS lookup and connection; context.userId is
// the "sent_by" attribution.
export const enviarNotificacaoOsWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => notificacaoOsSchema.parse(data))
  .handler(async ({ data, context }): Promise<WhatsappMensagem> => {
    return whatsappService.enviarNotificacaoOs({
      userId: await empresaDoUsuario(context, "ordens"),
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
    const empresaId = await empresaDoUsuario(context);
    await whatsappService.enfileirarPesquisasPosOs(empresaId);
    await whatsappService.enviarAniversarios(empresaId);
    await whatsappService.enviarPesquisasPosVenda(empresaId);
    const processadas = await whatsappService.processarNotificacoesAgendadasOs(empresaId);
    return { processadas };
  });

// Aviso automático "OS pronta" — a tela de OS chama depois de mudar o status.
// A leitura da OS usa o cliente do usuário (RLS): só quem enxerga a OS dispara
// o aviso, e o envio sai pela conexão da empresa dona da OS.
export const avisarOsProntaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ osId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<whatsappService.ResultadoAvisoPronta> => {
    const { data: os } = await context.supabase
      .from("ordens_servico")
      .select("user_id")
      .eq("id", data.osId)
      .maybeSingle();
    if (!os) throw new Error("OS não encontrada.");
    return whatsappService.avisarOsPronta({
      empresaId: os.user_id,
      osId: data.osId,
      sentBy: context.userId,
      origem: process.env["VITE_SITE_URL"] || origemAtual(),
    });
  });
