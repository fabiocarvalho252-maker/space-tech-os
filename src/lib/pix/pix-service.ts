// Orchestrates the Mercado Pago client (mercadopago-api.ts) with our own
// cobrancas/lancamentos tables. Server-only. Every function takes an
// already-authenticated/verified empresa id — never a value read from an
// incoming webhook body without first cross-checking it against our own
// `cobrancas` row.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MercadoPagoApiError, buscarPagamento, criarPagamentoPix } from "./mercadopago-api";

export class MercadoPagoNaoConfiguradoError extends Error {
  constructor() {
    super(
      "Cadastre as credenciais do Mercado Pago em Configurações → Mercado Pago antes de gerar um Pix.",
    );
    this.name = "MercadoPagoNaoConfiguradoError";
  }
}

type ConfigPagamento = { accessToken: string; webhookSecret: string | null };

async function obterConfig(empresaId: string): Promise<ConfigPagamento | null> {
  const { data: dataRaw, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mercado_pago_webhook_secret not in the generated Database type yet
    .from("pagamento_config" as any)
    .select("mercado_pago_access_token, mercado_pago_webhook_secret")
    .eq("user_id", empresaId)
    .maybeSingle();
  if (error) throw error;
  const data = dataRaw as unknown as {
    mercado_pago_access_token: string | null;
    mercado_pago_webhook_secret: string | null;
  } | null;
  if (!data?.mercado_pago_access_token) return null;
  return {
    accessToken: data.mercado_pago_access_token,
    webhookSecret: data.mercado_pago_webhook_secret ?? null,
  };
}

export type NovaCobrancaInput = {
  empresaId: string;
  valor: number;
  clienteId: string | null;
  osId: string | null;
  vendaId: string | null;
  origin: string;
};

export type Cobranca = {
  id: string;
  valor: number;
  status: string;
  qr_code: string | null;
  qr_code_copy_paste: string | null;
  expires_at: string | null;
};

export async function criarCobrancaPix(input: NovaCobrancaInput): Promise<Cobranca> {
  const config = await obterConfig(input.empresaId);
  if (!config) throw new MercadoPagoNaoConfiguradoError();

  let cliente: { nome: string | null; email: string | null; documento: string | null } | null =
    null;
  if (input.clienteId) {
    const { data } = await supabaseAdmin
      .from("clientes")
      .select("nome, email, documento")
      .eq("id", input.clienteId)
      .maybeSingle();
    cliente = data;
  }

  const { data: cobranca, error } = await supabaseAdmin
    .from("cobrancas")
    .insert({
      user_id: input.empresaId,
      cliente_id: input.clienteId,
      os_id: input.osId,
      venda_id: input.vendaId,
      valor: input.valor,
      status: "pendente",
    })
    .select("id")
    .single();
  if (error) throw error;

  const expiraEm = new Date(Date.now() + 30 * 60_000);
  try {
    const pagamento = await criarPagamentoPix({
      accessToken: config.accessToken,
      valor: input.valor,
      descricao: cliente?.nome ? `Cobrança SpaceTech — ${cliente.nome}` : "Cobrança SpaceTech",
      externalReference: cobranca.id,
      notificationUrl: `${input.origin}/api/pix/webhook`,
      payerEmail: cliente?.email || "cliente@spacetech.app",
      cpfCnpj: cliente?.documento ?? null,
      expiraEm,
    });

    const { data: atualizada, error: erroUpdate } = await supabaseAdmin
      .from("cobrancas")
      .update({
        mp_id: pagamento.mpId,
        qr_code: pagamento.qrCodeBase64,
        qr_code_copy_paste: pagamento.qrCode,
        expires_at: expiraEm.toISOString(),
      })
      .eq("id", cobranca.id)
      .select("id, valor, status, qr_code, qr_code_copy_paste, expires_at")
      .single();
    if (erroUpdate) throw erroUpdate;
    return atualizada;
  } catch (e) {
    // Don't leave a cobranca stuck "pendente" forever with no way to pay it.
    await supabaseAdmin.from("cobrancas").delete().eq("id", cobranca.id);
    if (e instanceof MercadoPagoApiError) throw e;
    throw e;
  }
}

const STATUS_MP_PARA_COBRANCA: Record<string, "pendente" | "paga" | "cancelada" | "expirada"> = {
  pending: "pendente",
  in_process: "pendente",
  approved: "paga",
  rejected: "cancelada",
  cancelled: "cancelada",
  refunded: "cancelada",
  charged_back: "cancelada",
};

/**
 * Re-fetches a payment from Mercado Pago's own API (never trusts a
 * webhook's claimed status directly) and syncs our cobranca + financeiro to
 * match. Called from the webhook handler once it has cross-checked which
 * empresa a given mp_id actually belongs to.
 */
export async function reconciliarPagamento(mpId: string): Promise<void> {
  const { data: cobrancaRaw, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lancamento_id not in the generated Database type yet
    .from("cobrancas" as any)
    .select(
      "id, user_id, valor, status, lancamento_id, cliente_id, os_id, venda_id, clientes(nome)",
    )
    .eq("mp_id", mpId)
    .maybeSingle();
  if (error) throw error;
  const cobranca = cobrancaRaw as unknown as {
    id: string;
    user_id: string;
    valor: number;
    status: string;
    lancamento_id: string | null;
    clientes: { nome: string } | null;
  } | null;
  if (!cobranca) return; // not one of ours — nothing to do

  const config = await obterConfig(cobranca.user_id);
  if (!config) return;

  const pagamento = await buscarPagamento(config.accessToken, mpId);
  const novoStatus = STATUS_MP_PARA_COBRANCA[pagamento.status] ?? "pendente";
  if (novoStatus === cobranca.status && cobranca.lancamento_id) return; // already reconciled

  let lancamentoId = cobranca.lancamento_id;
  if (novoStatus === "paga" && !lancamentoId) {
    const nomeCliente = cobranca.clientes?.nome;
    const { data: lancamento, error: erroLanc } = await supabaseAdmin
      .from("lancamentos")
      .insert({
        user_id: cobranca.user_id,
        tipo: "entrada",
        categoria: "Cobrança Pix",
        descricao: nomeCliente ? `Pix recebido — ${nomeCliente}` : "Pix recebido",
        valor: cobranca.valor,
        status: "pago",
      })
      .select("id")
      .single();
    if (erroLanc) throw erroLanc;
    lancamentoId = lancamento.id;
  }

  const { error: erroUpdate } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- lancamento_id not in the generated Database type yet
    .from("cobrancas" as any)
    .update({ status: novoStatus, lancamento_id: lancamentoId })
    .eq("id", cobranca.id);
  if (erroUpdate) throw erroUpdate;
}

/**
 * Manual fallback for when Mercado Pago's webhook never arrives (unreachable
 * notification_url, dropped delivery, ...) — same reconciliation logic as
 * reconciliarPagamento, just entered from "Verificar pagamento" in the
 * Cobranças screen instead of a webhook call. Scoped to empresaId so a
 * staff member can only ever re-check their own company's cobranças.
 */
export async function verificarPagamentoCobranca(
  cobrancaId: string,
  empresaId: string,
): Promise<void> {
  const { data: cobranca, error } = await supabaseAdmin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mp_id not in the generated Database type yet
    .from("cobrancas" as any)
    .select("mp_id, user_id")
    .eq("id", cobrancaId)
    .maybeSingle();
  if (error) throw error;
  const row = cobranca as unknown as { mp_id: string | null; user_id: string } | null;
  if (!row || row.user_id !== empresaId) throw new Error("Cobrança não encontrada.");
  if (!row.mp_id) throw new Error("Esta cobrança ainda não tem um pagamento Pix gerado.");

  await reconciliarPagamento(row.mp_id);
}

export async function obterSegredoWebhook(empresaId: string): Promise<string | null> {
  const config = await obterConfig(empresaId);
  return config?.webhookSecret ?? null;
}

/** Which empresa a given Mercado Pago payment id belongs to, purely from our own records. */
export async function obterEmpresaDoPagamento(mpId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("cobrancas")
    .select("user_id")
    .eq("mp_id", mpId)
    .maybeSingle();
  return data?.user_id ?? null;
}
