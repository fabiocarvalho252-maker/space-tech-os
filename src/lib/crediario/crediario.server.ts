// Crediário no servidor: Pix de parcela, mensagens de WhatsApp e a rotina
// de avisos chamada pelo pg_cron. Server-only, sempre com supabaseAdmin e
// um empresaId já validado pelo chamador (server function com sessão do
// usuário, ou o endpoint do cron autenticado por token) — nunca um id vindo
// do corpo de uma requisição sem conferência.
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  MercadoPagoNaoConfiguradoError,
  criarCobrancaPix,
  type Cobranca,
} from "@/lib/pix/pix-service";
import { enviarMensagem } from "@/lib/whatsapp/whatsapp-service";
import { numeroContrato } from "@/lib/crediario";

const FUSO = "America/Sao_Paulo";

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export function hojeSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
}

function horaSaoPaulo(agora = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(
      agora,
    ),
  );
}

// Token do endpoint /api/crediario/cron: derivado da service role key (já
// presente no servidor) em vez de um segredo novo; o mesmo valor está no
// Supabase Vault como crediario_cron_token para o pg_cron enviar.
export function tokenCronValido(recebido: string | null): boolean {
  const chave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!chave || !recebido) return false;
  const esperado = Buffer.from(createHmac("sha256", chave).update("crediario-cron").digest("hex"));
  const obtido = Buffer.from(recebido);
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}

type ParcelaCompleta = {
  id: string;
  numero: number;
  vencimento: string;
  valor: number;
  valorAtualizado: number;
  diasAtraso: number | null;
  status: string;
  empresaId: string;
  contrato: {
    id: string;
    numero: number;
    numParcelas: number;
    marca: string;
    modelo: string;
    status: string;
  };
  cliente: { id: string; nome: string; telefone: string | null };
};

async function carregarParcela(parcelaId: string, empresaId: string): Promise<ParcelaCompleta> {
  const { data: p, error } = await supabaseAdmin
    .from("vw_crediario_parcelas")
    .select(
      "id, numero, vencimento, valor, valor_atualizado, dias_atraso, status, user_id, contrato_id",
    )
    .eq("id", parcelaId)
    .eq("user_id", empresaId)
    .maybeSingle();
  if (error) throw error;
  if (!p) throw new Error("Parcela não encontrada.");

  const { data: c, error: erroContrato } = await supabaseAdmin
    .from("crediario_contratos")
    .select("id, numero, num_parcelas, marca, modelo, status, clientes(id, nome, telefone)")
    .eq("id", p.contrato_id!)
    .single();
  if (erroContrato) throw erroContrato;

  return {
    id: p.id!,
    numero: p.numero!,
    vencimento: p.vencimento!,
    valor: Number(p.valor),
    valorAtualizado: Number(p.valor_atualizado ?? p.valor),
    diasAtraso: p.dias_atraso,
    status: p.status!,
    empresaId,
    contrato: {
      id: c.id,
      numero: c.numero,
      numParcelas: c.num_parcelas,
      marca: c.marca,
      modelo: c.modelo,
      status: c.status,
    },
    cliente: {
      id: c.clientes!.id,
      nome: c.clientes!.nome,
      telefone: c.clientes!.telefone,
    },
  };
}

function exigirEmAberto(p: ParcelaCompleta) {
  if (p.status !== "aberta" && p.status !== "atrasada") {
    throw new Error("Esta parcela não está em aberto.");
  }
  if (p.contrato.status === "cancelado" || p.contrato.status === "quitado") {
    throw new Error("Este contrato está encerrado.");
  }
}

/** Fim do dia em São Paulo (UTC-3, sem horário de verão desde 2019), com
 * pelo menos 30 minutos de validade para quem gera o Pix às 23h50. */
function expiracaoDoDia(): Date {
  const fimDoDia = new Date(`${hojeSaoPaulo()}T23:59:00-03:00`);
  const minimo = new Date(Date.now() + 30 * 60_000);
  return fimDoDia > minimo ? fimDoDia : minimo;
}

async function pixDaParcela(p: ParcelaCompleta, origin: string): Promise<Cobranca> {
  // Reaproveita um Pix de hoje ainda válido e com o mesmo valor, em vez de
  // criar outro a cada clique/aviso.
  const { data: existente } = await supabaseAdmin
    .from("cobrancas")
    .select("id, valor, status, qr_code, qr_code_copy_paste, expires_at")
    .eq("crediario_parcela_id", p.id)
    .eq("status", "pendente")
    .gt("expires_at", new Date(Date.now() + 5 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente && Math.abs(Number(existente.valor) - p.valorAtualizado) < 0.005) {
    return existente as Cobranca;
  }

  return criarCobrancaPix({
    empresaId: p.empresaId,
    valor: p.valorAtualizado,
    clienteId: p.cliente.id,
    osId: null,
    vendaId: null,
    origin,
    crediarioParcelaId: p.id,
    vencimento: p.vencimento,
    expiraEm: expiracaoDoDia(),
    descricao: `Crediário ${numeroContrato(p.contrato.numero)} — parcela ${p.numero}/${p.contrato.numParcelas}`,
  });
}

export async function gerarPixParcela(params: {
  parcelaId: string;
  empresaId: string;
  origin: string;
}): Promise<Cobranca> {
  const p = await carregarParcela(params.parcelaId, params.empresaId);
  exigirEmAberto(p);
  return pixDaParcela(p, params.origin);
}

type TipoAviso = "vencimento" | "bloqueio" | "manual";

async function nomeLoja(empresaId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome")
    .eq("id", empresaId)
    .maybeSingle();
  return data?.loja || data?.nome || "SPACE TECH";
}

function montarTexto(tipo: TipoAviso, p: ParcelaCompleta, loja: string, comPix: boolean): string {
  const primeiroNome = p.cliente.nome.split(" ")[0];
  const aparelho = `${p.contrato.marca} ${p.contrato.modelo}`;
  const parcela = `${p.numero}/${p.contrato.numParcelas}`;
  const comoPagar = comPix
    ? "Para pagar via Pix, copie o código da próxima mensagem."
    : "Para pagar, procure a loja ou responda esta mensagem.";

  if (tipo === "bloqueio") {
    return (
      `Olá, ${primeiroNome}. Aqui é da ${loja}.\n\n` +
      `Seu ${aparelho} foi bloqueado porque a parcela ${parcela} está com ` +
      `${p.diasAtraso ?? 1} dia(s) de atraso. Valor atualizado: ${brl(p.valorAtualizado)}.\n\n` +
      `Assim que o pagamento for confirmado, o aparelho é liberado automaticamente. ${comoPagar}`
    );
  }

  const quando =
    p.status === "atrasada"
      ? `está com ${p.diasAtraso ?? 1} dia(s) de atraso`
      : p.vencimento === hojeSaoPaulo()
        ? "vence hoje"
        : `vence em ${p.vencimento.split("-").reverse().join("/")}`;
  return (
    `Olá, ${primeiroNome}! Aqui é da ${loja}.\n\n` +
    `A parcela ${parcela} do seu ${aparelho} (contrato ${numeroContrato(p.contrato.numero)}) ` +
    `${quando}, no valor de ${brl(p.valorAtualizado)}.\n\n` +
    `${comoPagar} Manter os pagamentos em dia evita o bloqueio do aparelho.`
  );
}

export type ResultadoAviso = { status: "enviado" | "falhou"; comPix: boolean; erro?: string };

/** Envia a mensagem (e o Pix copia-e-cola, quando o Mercado Pago está
 * configurado) pelo WhatsApp da empresa e registra em crediario_avisos. */
async function enviarAviso(
  p: ParcelaCompleta,
  tipo: TipoAviso,
  origin: string,
  enviadoPor: string | null,
): Promise<ResultadoAviso> {
  const telefone = (p.cliente.telefone ?? "").replace(/\D/g, "");
  let resultado: ResultadoAviso;

  if (telefone.length < 10) {
    resultado = { status: "falhou", comPix: false, erro: "Cliente sem telefone válido." };
  } else {
    let pix: Cobranca | null = null;
    try {
      pix = await pixDaParcela(p, origin);
    } catch (e) {
      if (!(e instanceof MercadoPagoNaoConfiguradoError)) {
        console.error(
          "[Crediário] Falha ao gerar Pix para aviso:",
          e instanceof Error ? e.message : e,
        );
      }
    }
    const comPix = !!pix?.qr_code_copy_paste;
    const loja = await nomeLoja(p.empresaId);

    try {
      const msg = await enviarMensagem(p.empresaId, telefone, montarTexto(tipo, p, loja, comPix));
      if (msg.status === "enviado" && comPix) {
        await enviarMensagem(p.empresaId, telefone, pix!.qr_code_copy_paste!);
      }
      resultado =
        msg.status === "enviado"
          ? { status: "enviado", comPix }
          : { status: "falhou", comPix, erro: "A Evolution API recusou a mensagem." };
    } catch (e) {
      resultado = { status: "falhou", comPix, erro: e instanceof Error ? e.message : String(e) };
    }
  }

  const { error } = await supabaseAdmin.from("crediario_avisos").insert({
    user_id: p.empresaId,
    contrato_id: p.contrato.id,
    parcela_id: p.id,
    tipo,
    status: resultado.status,
    telefone: telefone || null,
    erro: resultado.erro ?? null,
    com_pix: resultado.comPix,
    enviado_por: enviadoPor,
  });
  // 23505 = aviso automático já registrado por uma execução concorrente.
  if (error && error.code !== "23505") throw error;
  return resultado;
}

export async function enviarCobrancaWhatsapp(params: {
  parcelaId: string;
  empresaId: string;
  origin: string;
  userId: string;
}): Promise<ResultadoAviso> {
  const p = await carregarParcela(params.parcelaId, params.empresaId);
  exigirEmAberto(p);
  const resultado = await enviarAviso(p, "manual", params.origin, params.userId);
  if (resultado.status === "falhou") throw new Error(resultado.erro ?? "Falha ao enviar.");
  return resultado;
}

async function whatsappConectado(empresaId: string, cache: Map<string, boolean>) {
  if (!cache.has(empresaId)) {
    const { data } = await supabaseAdmin
      .from("whatsapp_connections")
      .select("status")
      .eq("user_id", empresaId)
      .maybeSingle();
    cache.set(empresaId, (data as { status?: string } | null)?.status === "conectado");
  }
  return cache.get(empresaId)!;
}

/**
 * Rotina horária (pg_cron → POST /api/crediario/cron). Só envia entre 9h e
 * 20h de Brasília. Empresas sem WhatsApp conectado são puladas sem
 * registro, para o aviso sair se conectarem mais tarde no mesmo dia.
 */
export async function processarAvisosCrediario(origin: string, agora = new Date()) {
  const hora = horaSaoPaulo(agora);
  if (hora < 9 || hora >= 20) return { enviados: 0, falhas: 0, foraDoHorario: true };

  const hoje = hojeSaoPaulo(agora);
  const candidatos: { parcelaId: string; empresaId: string; tipo: TipoAviso }[] = [];

  const { data: vencendo, error: e1 } = await supabaseAdmin
    .from("crediario_parcelas")
    .select("id, user_id, crediario_contratos!inner(status)")
    .eq("status", "aberta")
    .eq("vencimento", hoje)
    .in("crediario_contratos.status", ["ativo", "atrasado", "bloqueado"]);
  if (e1) throw e1;
  for (const p of vencendo ?? []) {
    candidatos.push({ parcelaId: p.id, empresaId: p.user_id, tipo: "vencimento" });
  }

  // Bloqueio automático (não o manual): avisa uma vez, pela parcela
  // atrasada mais antiga do contrato.
  const { data: bloqueados, error: e2 } = await supabaseAdmin
    .from("crediario_contratos")
    .select("id, user_id, crediario_parcelas(id, vencimento, status)")
    .eq("status", "bloqueado")
    .eq("bloqueio_manual", false);
  if (e2) throw e2;
  for (const c of bloqueados ?? []) {
    const atrasada = (c.crediario_parcelas ?? [])
      .filter((p) => p.status === "atrasada")
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
    if (atrasada)
      candidatos.push({ parcelaId: atrasada.id, empresaId: c.user_id, tipo: "bloqueio" });
  }

  if (!candidatos.length) return { enviados: 0, falhas: 0, foraDoHorario: false };

  const { data: jaAvisados, error: e3 } = await supabaseAdmin
    .from("crediario_avisos")
    .select("parcela_id, tipo")
    .in(
      "parcela_id",
      candidatos.map((c) => c.parcelaId),
    )
    .in("tipo", ["vencimento", "bloqueio"]);
  if (e3) throw e3;
  const avisados = new Set((jaAvisados ?? []).map((a) => `${a.parcela_id}:${a.tipo}`));

  const conectado = new Map<string, boolean>();
  let enviados = 0;
  let falhas = 0;
  for (const c of candidatos) {
    if (avisados.has(`${c.parcelaId}:${c.tipo}`)) continue;
    if (!(await whatsappConectado(c.empresaId, conectado))) continue;
    try {
      const p = await carregarParcela(c.parcelaId, c.empresaId);
      const r = await enviarAviso(p, c.tipo, origin, null);
      if (r.status === "enviado") enviados++;
      else falhas++;
    } catch (e) {
      falhas++;
      console.error("[Crediário] Falha no aviso:", e instanceof Error ? e.message : e);
    }
  }
  return { enviados, falhas, foraDoHorario: false };
}
