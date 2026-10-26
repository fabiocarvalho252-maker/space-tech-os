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
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import * as whatsappService from "./whatsapp-service";
import * as fila from "./fila.server";
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

export type Ctx = { supabase: SupabaseClient<Database>; userId: string };

// Empresa em que o login trabalha — a mesma regra de useMinhaEmpresa: um
// convite para outra empresa vence a empresa própria (vazia) do funcionário.
// Sem isso, funcionário convidado conectava/enviava pela própria conta.
// Com `modulo`, exige a permissão (has_permission) nessa empresa.
export async function empresaDoUsuario(
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

export const reiniciarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsappConexao | null> => {
    return whatsappService.reiniciar(await empresaDoUsuario(context, "configuracoes", "gerenciar"));
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
  .validator((data: unknown) =>
    z
      .object({ direcao: z.enum(["todas", "inbound", "outbound"]).default("todas") })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<WhatsappMensagem[]> => {
    return whatsappService.listarMensagensRecentes(
      await empresaDoUsuario(context, "clientes"),
      data.direcao,
    );
  });

// Reclamações da pesquisa de satisfação (agente de IA) para o sininho.
export const listarReclamacoesPesquisaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<whatsappService.ReclamacaoPesquisa[]> => {
    return whatsappService.listarReclamacoesPesquisa(await empresaDoUsuario(context, "clientes"));
  });

export const resolverReclamacaoPesquisaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id: z.guid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await whatsappService.resolverReclamacaoPesquisa(
      await empresaDoUsuario(context, "clientes"),
      data.id,
    );
    return { ok: true };
  });

const notificacaoOsSchema = z.object({
  osId: z.guid(),
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

// Complemento do worker do servidor (/api/whatsapp/fila/cron): com o
// sistema aberto, o AppShell chama a cada 10 minutos — gera as mensagens
// automáticas e manda o que a fila já deixa sair.
export const processarNotificacoesAgendadasWhatsAppFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ processadas: number }> => {
    const empresaId = await empresaDoUsuario(context);
    await whatsappService.rodarAutomacoes(empresaId);
    const processadas = await whatsappService.processarNotificacoesAgendadasOs(empresaId);
    return { processadas };
  });

// Aviso automático "OS pronta" — a tela de OS chama depois de mudar o status.
// A leitura da OS usa o cliente do usuário (RLS): só quem enxerga a OS dispara
// o aviso, e o envio sai pela conexão da empresa dona da OS.
export const avisarOsProntaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ osId: z.guid() }).parse(data))
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

// ---- Fila WhatsApp (/whatsapp-fila) ----

const idSchema = z.object({ id: z.guid() });

export const resumoFilaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<fila.ResumoFila> =>
    fila.resumoFila(await empresaDoUsuario(context, "configuracoes", "ver")),
  );

export const listarFilaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({ aba: z.enum(["aprovacao", "agendadas", "falhas", "enviadas", "canceladas"]) })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<fila.ItemFila[]> =>
    fila.listarFila(await empresaDoUsuario(context, "configuracoes", "ver"), data.aba),
  );

export const enviarAgoraFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ status: "enviado" | "falhou" }> => ({
    status: await fila.enviarAgora(
      await empresaDoUsuario(context, "configuracoes", "gerenciar"),
      data.id,
    ),
  }));

export const reagendarFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.guid(), quando: z.string().datetime() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await fila.reagendar(
      await empresaDoUsuario(context, "configuracoes", "gerenciar"),
      data.id,
      data.quando,
    );
    return { ok: true };
  });

export const editarTextoFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ id: z.guid(), texto: z.string().trim().min(1).max(4000) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await fila.editarTexto(
      await empresaDoUsuario(context, "configuracoes", "gerenciar"),
      data.id,
      data.texto,
    );
    return { ok: true };
  });

export const cancelarFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await fila.cancelar(await empresaDoUsuario(context, "configuracoes", "gerenciar"), data.id);
    return { ok: true };
  });

export const reenviarFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await fila.reenviar(await empresaDoUsuario(context, "configuracoes", "gerenciar"), data.id);
    return { ok: true };
  });

export const reenviarFalhasFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ quantidade: number }> => ({
    quantidade: await fila.reenviarTodasFalhas(
      await empresaDoUsuario(context, "configuracoes", "gerenciar"),
    ),
  }));

export const salvarRegrasFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        intervaloSeg: z.number().int().min(5).max(600),
        horaInicio: z.number().int().min(0).max(23),
        horaFim: z.number().int().min(1).max(24),
        limiteHora: z.number().int().min(1).max(500),
      })
      .refine((r) => r.horaFim > r.horaInicio, {
        message: "O horário final precisa ser depois do inicial.",
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await fila.salvarRegras(await empresaDoUsuario(context, "configuracoes", "gerenciar"), data);
    return { ok: true };
  });
