// Server functions do "Enviar link de assinatura" (Administração do site).
// Só o operador do site (checarSiteAdmin); a mensagem sai pelo WhatsApp da
// empresa SPACE TECH (enviarDaPlataforma), a mesma conexão dos avisos da
// plataforma, e fica registrada em convites_assinatura.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checarSiteAdmin } from "@/lib/site-admin.functions";
import { comTaxaRepassada } from "@/lib/mercadopago/fees";
import { chaveTelefone } from "@/lib/whatsapp/telefone";
import { normalizarTelefoneConvite, type Precos } from "@/lib/convites-assinatura";

/** Preços do plano ativo mais barato, como a empresa vai pagar no Pix. */
export const precosConviteFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Precos> => {
    checarSiteAdmin(context.claims);
    const { data } = await supabaseAdmin
      .from("plans")
      .select("monthly_price, annual_price")
      .eq("active", true)
      .order("monthly_price", { ascending: true })
      .limit(1)
      .maybeSingle();
    const preco = (v: number | null | undefined) =>
      v && v > 0 ? comTaxaRepassada(v, "pix") : null;
    return { mensal: preco(data?.monthly_price), anual: preco(data?.annual_price) };
  });

type ContaExistente = { loja: string; criadaEm: string };

async function contasPorChave(): Promise<Map<string, ContaExistente[]>> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome, whatsapp, created_at")
    .not("whatsapp", "is", null)
    .limit(5000);
  const mapa = new Map<string, ContaExistente[]>();
  for (const p of data ?? []) {
    const chave = chaveTelefone(p.whatsapp ?? "");
    if (chave.length < 10) continue;
    const lista = mapa.get(chave) ?? [];
    lista.push({ loja: p.loja || p.nome || "Sem nome", criadaEm: p.created_at });
    mapa.set(chave, lista);
  }
  return mapa;
}

/** Antes de enviar: este telefone já tem conta no SPACE TECH? */
export const contaDoTelefoneFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ telefone: z.string().max(40) }).parse(data))
  .handler(async ({ data, context }): Promise<ContaExistente | null> => {
    checarSiteAdmin(context.claims);
    const numero = normalizarTelefoneConvite(data.telefone);
    if (!numero) return null;
    return (await contasPorChave()).get(chaveTelefone(numero))?.[0] ?? null;
  });

export const enviarLinkAssinaturaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) =>
    z
      .object({
        nome: z.string().trim().max(80).nullable(),
        telefone: z.string().max(40),
        oferta: z.enum(["teste", "mensal", "anual"]),
        texto: z.string().trim().min(10).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    checarSiteAdmin(context.claims);
    const numero = normalizarTelefoneConvite(data.telefone);
    if (!numero) throw new Error("WhatsApp inválido — informe DDD + número.");

    const { enviarDaPlataforma } = await import("@/lib/whatsapp/whatsapp-service");
    const { data: convite, error } = await supabaseAdmin
      .from("convites_assinatura")
      .insert({
        nome: data.nome || null,
        telefone: numero,
        chave_telefone: chaveTelefone(numero),
        oferta: data.oferta,
        mensagem: data.texto,
        status: "falhou",
        enviado_por: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;

    const envio = await enviarDaPlataforma({
      telefone: numero,
      nome: data.nome || null,
      mensagem: data.texto,
      templateId: `convite_assinatura_${convite.id}`,
    });
    const erro =
      envio === "sem_conexao"
        ? "O WhatsApp da SPACE TECH está desconectado. Conecte em WhatsApp → Conexão ou use “Abrir no meu WhatsApp”."
        : envio === "falhou"
          ? "O WhatsApp recusou o envio. Confira o número."
          : null;
    await supabaseAdmin
      .from("convites_assinatura")
      .update({ status: erro ? "falhou" : "enviado", erro })
      .eq("id", convite.id);
    if (erro) throw new Error(erro);
    return { ok: true };
  });

export type ConviteEnviado = {
  id: string;
  nome: string | null;
  telefone: string;
  oferta: "teste" | "mensal" | "anual";
  status: "enviado" | "falhou";
  erro: string | null;
  enviadoEm: string;
  /** Conta criada com este telefone depois do envio (virou cliente). */
  cadastrou: ContaExistente | null;
  /** Já tinha conta antes do envio. */
  jaTinhaConta: ContaExistente | null;
};

export const listarConvitesAssinaturaFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConviteEnviado[]> => {
    checarSiteAdmin(context.claims);
    const [{ data, error }, contas] = await Promise.all([
      supabaseAdmin
        .from("convites_assinatura")
        .select("id, nome, telefone, chave_telefone, oferta, status, erro, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      contasPorChave(),
    ]);
    if (error) throw error;
    return (data ?? []).map((c) => {
      const doTelefone = contas.get(c.chave_telefone) ?? [];
      const depois = doTelefone.find((p) => p.criadaEm >= c.created_at) ?? null;
      const antes = doTelefone.find((p) => p.criadaEm < c.created_at) ?? null;
      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        oferta: c.oferta as ConviteEnviado["oferta"],
        status: c.status as ConviteEnviado["status"],
        erro: c.erro,
        enviadoEm: c.created_at,
        cadastrou: depois,
        jaTinhaConta: depois ? null : antes,
      };
    });
  });
