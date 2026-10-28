// Server functions da Central de WhatsApp (tela /whatsapp). Mesmo padrão de
// whatsapp.functions.ts: a empresa e o papel vêm da sessão verificada
// (empresaDoUsuario + has_permission + empresa_role), nunca do navegador.
//   - módulo "whatsapp" ver       → listar e ler conversas;
//   - módulo "whatsapp" gerenciar → responder, assumir, encerrar, anexos;
//   - admin/gerente               → supervisionam (ver central.server.ts).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as central from "./central.server";
import { empresaDoUsuario, type Ctx } from "./whatsapp.functions";

async function acesso(context: Ctx, acao: "ver" | "gerenciar") {
  let empresaId: string;
  try {
    empresaId = await empresaDoUsuario(context, "whatsapp", acao);
  } catch {
    throw new Error(
      acao === "ver"
        ? "Seu usuário não tem acesso ao WhatsApp. Peça ao administrador em Usuários → Permissões."
        : "Seu usuário só pode acompanhar as conversas, não responder.",
    );
  }
  const { data: papel } = await context.supabase.rpc("empresa_role", { p_empresa_id: empresaId });
  const ator: central.Ator = { id: context.userId, papel: (papel as central.Papel | null) ?? null };
  return { empresaId, ator };
}

async function pode(
  context: Ctx,
  empresaId: string,
  modulo: string,
  acao: "ver" | "gerenciar" = "ver",
): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_permission", {
    p_empresa_id: empresaId,
    p_modulo: modulo,
    p_acao: acao,
  });
  return !!data;
}

const id = z.string().uuid();
const iso = z.string().datetime({ offset: true }).nullable();

export const acessoCentralFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { empresaId, ator } = await acesso(context, "ver");
    const [podeResponder, verOrdens, equipe, roboAtivo] = await Promise.all([
      pode(context, empresaId, "whatsapp", "gerenciar"),
      pode(context, empresaId, "ordens"),
      central.listarEquipe(empresaId),
      central.roboAtivoNaEmpresa(empresaId),
    ]);
    return {
      euId: ator.id,
      supervisor: central.ehSupervisor(ator.papel),
      podeResponder,
      verOrdens,
      equipe,
      roboAtivo,
      maxAnexoMb: Math.round(central.midiaMaxBytes() / 1024 / 1024),
    };
  });

export const listarConversasFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        filtro: z
          .enum(["todas", "nao_lidas", "abertas", "aguardando", "minhas", "encerradas"])
          .default("todas"),
        busca: z.string().max(80).default(""),
        antesDe: iso.default(null),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "ver");
    return central.listarConversas({ empresaId, atorId: ator.id, ...data, limite: 30 });
  });

export const naoLidasCentralFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    try {
      const { empresaId, ator } = await acesso(context, "ver");
      return await central.contarNaoLidas(empresaId, ator.id);
    } catch {
      return 0;
    }
  });

export const obterConversaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ conversaId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.obterConversa(empresaId, data.conversaId);
  });

export const listarMensagensFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ conversaId: id, antesDe: iso.default(null) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.listarMensagens({ empresaId, ...data, limite: 40 });
  });

export const marcarLidaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ conversaId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    await central.marcarLida(empresaId, data.conversaId);
  });

export const contextoConversaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ conversaId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.contexto({
      empresaId,
      conversaId: data.conversaId,
      verOrdens: await pode(context, empresaId, "ordens"),
    });
  });

const acaoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("assumir"), conversaId: id }),
  z.object({ acao: z.literal("liberar"), conversaId: id }),
  z.object({ acao: z.literal("encerrar"), conversaId: id }),
  z.object({ acao: z.literal("reabrir"), conversaId: id }),
  z.object({ acao: z.literal("transferir"), conversaId: id, paraId: id }),
  z.object({ acao: z.literal("vincular"), conversaId: id, clienteId: id.nullable() }),
  z.object({ acao: z.literal("opt_out"), conversaId: id, ativo: z.boolean() }),
  z.object({ acao: z.literal("robo"), conversaId: id, ativo: z.boolean() }),
  z.object({
    acao: z.literal("detalhes"),
    conversaId: id,
    prioridade: z.enum(["baixa", "normal", "alta"]).optional(),
    etiquetas: z.array(z.string().max(30)).max(10).optional(),
  }),
]);
export type AcaoConversa = z.infer<typeof acaoSchema>;

export const acaoConversaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => acaoSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "gerenciar");
    switch (data.acao) {
      case "assumir":
        return central.assumir(empresaId, ator, data.conversaId);
      case "liberar":
        return central.liberar(empresaId, ator, data.conversaId);
      case "encerrar":
        return central.alterarStatus(empresaId, ator, data.conversaId, "encerrada");
      case "reabrir":
        return central.alterarStatus(empresaId, ator, data.conversaId, "aberta");
      case "transferir":
        return central.transferir(empresaId, ator, data.conversaId, data.paraId);
      case "vincular":
        return central.vincularCliente(empresaId, ator, data.conversaId, data.clienteId);
      case "opt_out":
        return central.definirOptOut(empresaId, ator, data.conversaId, data.ativo);
      case "robo":
        return central.definirRoboConversa(empresaId, ator, data.conversaId, data.ativo);
      case "detalhes":
        return central.alterarDetalhes(empresaId, ator, data.conversaId, {
          ...(data.prioridade ? { prioridade: data.prioridade } : {}),
          ...(data.etiquetas ? { etiquetas: data.etiquetas } : {}),
        });
    }
  });

export const enviarTextoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        conversaId: id,
        texto: z.string().trim().min(1).max(4096),
        vistoAte: iso.default(null),
        forcar: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "gerenciar");
    await central.enviarTexto({ empresaId, ator, ...data });
  });

export const reenviarTextoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ mensagemId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "gerenciar");
    await central.reenviarTexto({ empresaId, ator, mensagemId: data.mensagemId });
  });

// base64 de até 64 MB de arquivo (o limite real vem de WHATSAPP_MEDIA_MAX_SIZE_MB
// e é conferido de novo em validarAnexo, pelos bytes).
const MAX_BASE64 = Math.ceil((64 * 1024 * 1024 * 4) / 3);

export const enviarAnexoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        conversaId: id,
        nome: z.string().min(1).max(200),
        base64: z
          .string()
          .min(1)
          .max(MAX_BASE64)
          .regex(/^[A-Za-z0-9+/]+=*$/),
        legenda: z.string().max(1024).default(""),
        vistoAte: iso.default(null),
        forcar: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "gerenciar");
    await central.enviarAnexo({ empresaId, ator, ...data });
  });

export const linkAnexoFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ mensagemId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.linkAnexo(empresaId, data.mensagemId);
  });

export const respostasRapidasFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.listarRespostasRapidas(empresaId);
  });

export const salvarRespostaRapidaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        id: id.optional(),
        atalho: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9_-]{1,30}$/, "Atalho: só letras sem acento, números, - e _ (até 30)."),
        texto: z.string().trim().min(1).max(4096),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "gerenciar");
    await central.salvarRespostaRapida(empresaId, data);
  });

export const excluirRespostaRapidaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "gerenciar");
    await central.excluirRespostaRapida(empresaId, data.id);
  });

export const sugestaoIAFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z.object({ conversaId: id, modo: z.enum(["responder", "resumir"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "gerenciar");
    return central.sugestaoIA({
      empresaId,
      atorId: ator.id,
      conversaId: data.conversaId,
      modo: data.modo,
      verOrdens: await pode(context, empresaId, "ordens"),
    });
  });

export const contarFiltrosFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { empresaId, ator } = await acesso(context, "ver");
    return central.contarFiltros(empresaId, ator.id);
  });

export const listarArquivosFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ conversaId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.listarArquivos(empresaId, data.conversaId);
  });

export const listarAutomacoesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ conversaId: id }).parse(data))
  .handler(async ({ data, context }) => {
    const { empresaId } = await acesso(context, "ver");
    return central.listarAutomacoes(empresaId, data.conversaId);
  });

export const iniciarConversaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        numero: z.string().trim().min(10).max(20),
        texto: z.string().trim().min(1).max(4096),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { empresaId, ator } = await acesso(context, "gerenciar");
    return central.iniciarConversa({ empresaId, ator, ...data });
  });
