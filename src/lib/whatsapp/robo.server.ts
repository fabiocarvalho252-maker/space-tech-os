// Robô de atendimento do WhatsApp — lado servidor. Chamado pelo webhook
// depois que a mensagem do cliente foi gravada. As regras da conversa e os
// textos ficam em robo.ts (puro, testado); aqui só se decide SE o robô
// fala, busca OS/garantias do próprio número e envia.
//
// O robô fica quieto quando:
//   - está desligado na empresa ou o WhatsApp não está conectado;
//   - o cliente pediu PARAR (ou a mensagem é o próprio PARAR/VOLTAR);
//   - a conversa está com um atendente (atribuída) ou pausada;
//   - alguém da equipe respondeu nas últimas 2 h (central ou celular);
//   - a mensagem veio do próprio número da loja (outro aparelho da conta);
//   - a conversa ia começar mas já teve mensagem nas últimas 12 h (é papo
//     em andamento, não um contato novo) ou a loja mandou um aviso
//     automático nas últimas 24 h (o cliente está respondendo o aviso);
//   - já mandou mensagens demais na última hora (outro robô do outro lado).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brl, statusLabel } from "@/lib/format";
import { chaveTelefone } from "./telefone";
import { pedidoDeParar, pedidoDeVoltar } from "./automacoes";
import { clientesComTelefone } from "./central.server";
import { enviarAutomatico, obterEmpresaDoOperador } from "./whatsapp-service";
import { comTaxaRepassada } from "@/lib/mercadopago/fees";
import { origemPublicaServer } from "@/lib/site-url.server";
import * as robo from "./robo";

const HORA = 3_600_000;
const PAUSA_APOS_HUMANO_MS = 2 * HORA;
const SILENCIO_APOS_AVISO_MS = 24 * HORA;
const CONVERSA_PARADA_MS = 12 * HORA;
/** Rajada do cliente no começo (oi + pergunta + áudio) conta como um contato só. */
const RAJADA_INICIAL_MS = 2 * 60_000;
/** O que é digitado no celular da loja entra no sistema ~8 s depois (ver
 * webhook-handler): espera isso antes de decidir se alguém está atendendo. */
const ESPERA_CELULAR_MS = 10_000;
const MAX_RESPOSTAS_POR_HORA = 12;
const STATUS_ENCERRADOS = ["entregue", "faturado"];

type Params = {
  instanceName: string;
  numero: string;
  texto: string | null;
  temMidia: boolean;
  /** Horário de envio no WhatsApp; mensagem velha (sessão travada) não é respondida. */
  enviadaEm?: string | null;
  recebidaEm?: number;
};

/** Mensagem que chega mais atrasada que isso é fila acumulada: o robô não responde. */
const ATRASO_MAXIMO_MS = 5 * 60_000;

// Mensagens seguidas do mesmo cliente são tratadas uma de cada vez, na
// ordem — senão duas respostas disputariam a mesma etapa.
const filas = new Map<string, Promise<void>>();

export function processarMensagemRobo(entrada: Params): Promise<void> {
  const params = { ...entrada, recebidaEm: entrada.recebidaEm ?? Date.now() };
  const chave = `${params.instanceName}:${chaveTelefone(params.numero)}`;
  const atual = (filas.get(chave) ?? Promise.resolve()).then(() =>
    processar(params).catch((e) =>
      console.error("[robo-whatsapp] falha:", e instanceof Error ? e.message : e),
    ),
  );
  filas.set(chave, atual);
  void atual.finally(() => {
    if (filas.get(chave) === atual) filas.delete(chave);
  });
  return atual;
}

async function evento(
  empresaId: string,
  conversaId: string,
  tipo: string,
  detalhes: Record<string, string | null> | null = null,
) {
  const { error } = await supabaseAdmin.from("whatsapp_conversa_eventos").insert({
    user_id: empresaId,
    conversa_id: conversaId,
    autor_id: null,
    tipo,
    detalhes,
  });
  if (error) console.error("[robo-whatsapp] evento não gravado:", tipo, error.message);
}

async function processar(params: Params): Promise<void> {
  if (pedidoDeParar(params.texto) || pedidoDeVoltar(params.texto)) return;
  if (
    params.enviadaEm &&
    (params.recebidaEm ?? Date.now()) - new Date(params.enviadaEm).getTime() > ATRASO_MAXIMO_MS
  )
    return;

  const { data: conexao } = await supabaseAdmin
    .from("whatsapp_connections")
    .select("id, user_id, instance_name, status, phone_number")
    .eq("instance_name", params.instanceName)
    .maybeSingle();
  if (!conexao || conexao.status !== "conectado") return;
  if (conexao.phone_number && chaveTelefone(conexao.phone_number) === chaveTelefone(params.numero))
    return;
  const empresaId = conexao.user_id;

  const { data: config } = await supabaseAdmin
    .from("whatsapp_config")
    .select("robo_ativo, robo_horario, robo_textos")
    .eq("user_id", empresaId)
    .maybeSingle();
  if (!config?.robo_ativo) return;

  const falta = (params.recebidaEm ?? Date.now()) + ESPERA_CELULAR_MS - Date.now();
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));

  const { data: conversa } = await supabaseAdmin
    .from("whatsapp_conversas")
    .select(
      "id, cliente_id, contact_name, atribuida_a, opt_out_em, etiquetas, robo_etapa, robo_dados, robo_atualizado_em, robo_pausado_ate, clientes(nome)",
    )
    .eq("user_id", empresaId)
    .eq("chave_telefone", chaveTelefone(params.numero))
    .maybeSingle();
  if (!conversa) return;

  const agora = new Date();
  if (conversa.opt_out_em || conversa.atribuida_a) return;
  if (robo.roboPausado(conversa.robo_pausado_ate, agora)) return;

  const { data: enviadas } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("template_id, sent_by, metadata, created_at, status")
    .eq("user_id", empresaId)
    .eq("conversa_id", conversa.id)
    .eq("direction", "outbound")
    .gte("created_at", new Date(agora.getTime() - SILENCIO_APOS_AVISO_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(60);
  const desde = (ms: number) => (m: { created_at: string }) =>
    agora.getTime() - new Date(m.created_at).getTime() <= ms;
  const ehHumano = (m: { sent_by: string | null; metadata: unknown }) =>
    !!m.sent_by || (m.metadata as { origem?: string } | null)?.origem === "celular";
  const ehRobo = (m: { template_id: string | null }) => !!m.template_id?.startsWith("robo_");
  const lista = enviadas ?? [];

  if (lista.some((m) => ehHumano(m) && desde(PAUSA_APOS_HUMANO_MS)(m))) return;

  const horario = robo.lerHorario(config.robo_horario);
  if (lista.filter((m) => ehRobo(m) && desde(HORA)(m)).length >= MAX_RESPOSTAS_POR_HORA) {
    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({ robo_pausado_ate: robo.fimDaPausaAtendente(horario, agora).toISOString() })
      .eq("id", conversa.id);
    await evento(empresaId, conversa.id, "robo_limite");
    return;
  }

  const estado: robo.EstadoRobo = {
    etapa: conversa.robo_etapa,
    dados: (conversa.robo_dados ?? {}) as robo.DadosRobo,
    atualizadoEm: conversa.robo_atualizado_em,
  };
  if (robo.etapaVigente(estado, agora) === null) {
    // Só conta o que chegou ao cliente (falhou/cancelado ele nem viu).
    const avisoRecente = lista.some(
      (m) => !ehHumano(m) && !ehRobo(m) && (m.status === "enviado" || m.status === "pendente"),
    );
    if (avisoRecente) return;
    // Contato novo = conversa parada há 12 h (fora a rajada desta chegada).
    const recebida = params.recebidaEm ?? agora.getTime();
    const { data: anteriores } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("template_id")
      .eq("user_id", empresaId)
      .eq("conversa_id", conversa.id)
      .gte("created_at", new Date(recebida - CONVERSA_PARADA_MS).toISOString())
      .lt("created_at", new Date(recebida - RAJADA_INICIAL_MS).toISOString())
      .limit(20);
    if ((anteriores ?? []).some((m) => !m.template_id?.startsWith("robo_"))) return;
  }

  const ctx: robo.Contexto = {
    loja: await nomeDaLoja(empresaId),
    nome: robo.primeiroNome(conversa.clientes?.nome ?? conversa.contact_name),
    aberto: robo.estaAberto(horario, agora),
    abre: robo.proximaAbertura(horario, agora),
    planos: empresaId === (await obterEmpresaDoOperador()) ? await planosDoSite() : null,
    textos: robo.lerTextos(config.robo_textos),
  };
  const decisao = robo.decidir(
    estado,
    params.texto,
    agora,
    params.temMidia,
    robo.opcoesAtivas(ctx),
  );
  if (decisao.tipo === "ignorar") return;

  let resposta: string;
  let proxima: { etapa: robo.Etapa | null; dados: robo.DadosRobo } = { etapa: "menu", dados: {} };
  let depois: (() => Promise<void>) | null = null;

  switch (decisao.tipo) {
    case "menu":
      resposta = robo.textoMenu(ctx, decisao.saudacao);
      break;
    case "planos":
      resposta = robo.textoPlanos(ctx, decisao.saudacao);
      break;
    case "nao_entendeu":
      resposta = robo.textoNaoEntendi(ctx);
      proxima = { etapa: "menu", dados: { erros: decisao.erros } };
      break;
    case "status":
      resposta = robo.textoStatus(
        await ordensDoNumero(empresaId, conversa.cliente_id, params.numero),
      );
      break;
    case "garantia":
      resposta = robo.textoGarantia(
        await garantiasDoNumero(empresaId, conversa.cliente_id, params.numero, agora),
      );
      break;
    case "orc_aparelho":
      resposta = robo.textoPerguntaAparelho(ctx);
      proxima = { etapa: "orc_aparelho", dados: {} };
      break;
    case "orc_defeito":
      resposta = robo.textoPerguntaDefeito(decisao.aparelho, ctx);
      proxima = { etapa: "orc_defeito", dados: { aparelho: decisao.aparelho } };
      break;
    case "orc_registrar":
      resposta = robo.textoOrcamentoRegistrado(ctx, decisao.aparelho, decisao.defeito);
      proxima = { etapa: null, dados: {} };
      depois = () =>
        passarParaEquipe(empresaId, conversa, horario, agora, "Orçamento", {
          tipo: "robo_orcamento",
          detalhes: { aparelho: decisao.aparelho, defeito: decisao.defeito },
        });
      break;
    case "atendente":
      resposta = robo.textoAtendente(ctx, decisao.motivo);
      proxima = { etapa: null, dados: {} };
      depois = () =>
        passarParaEquipe(empresaId, conversa, horario, agora, "Pediu atendente", {
          tipo: "robo_atendente",
          detalhes: { motivo: decisao.motivo },
          prioridade: "alta",
        });
      break;
  }

  const status = await enviarAutomatico({
    empresaId,
    conexao,
    numeroCompleto: params.numero,
    nome: conversa.clientes?.nome ?? conversa.contact_name,
    mensagem: resposta,
    templateId: `robo_${decisao.tipo}`,
  });
  if (status !== "enviado") return;

  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({
      robo_etapa: proxima.etapa,
      robo_dados: proxima.dados,
      robo_atualizado_em: new Date().toISOString(),
    })
    .eq("id", conversa.id);
  if (depois) await depois();
}

/** Orçamento anotado ou pediu atendente: etiqueta, evento e robô quieto. */
async function passarParaEquipe(
  empresaId: string,
  conversa: { id: string; etiquetas: string[] },
  horario: robo.Horario,
  agora: Date,
  etiqueta: string,
  registro: {
    tipo: string;
    detalhes: Record<string, string>;
    prioridade?: "alta";
  },
) {
  const etiquetas = [...new Set([...(conversa.etiquetas ?? []), etiqueta])].slice(0, 10);
  await supabaseAdmin
    .from("whatsapp_conversas")
    .update({
      etiquetas,
      robo_pausado_ate: robo.fimDaPausaAtendente(horario, agora).toISOString(),
      ...(registro.prioridade ? { prioridade: registro.prioridade } : {}),
    })
    .eq("id", conversa.id);
  await evento(empresaId, conversa.id, registro.tipo, registro.detalhes);
}

/** Opção 5 do WhatsApp da SPACE TECH: preços do plano ativo mais barato (Pix). */
async function planosDoSite(): Promise<robo.PlanosSite> {
  const { data } = await supabaseAdmin
    .from("plans")
    .select("monthly_price, annual_price")
    .eq("active", true)
    .order("monthly_price", { ascending: true })
    .limit(1)
    .maybeSingle();
  const preco = (v: number | null | undefined) =>
    v && v > 0 ? brl(comTaxaRepassada(v, "pix")) : null;
  return {
    mensal: preco(data?.monthly_price),
    anual: preco(data?.annual_price),
    link: `${origemPublicaServer() || "https://srmpretech.online"}/cadastro`,
  };
}

async function nomeDaLoja(empresaId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome")
    .eq("id", empresaId)
    .maybeSingle();
  return (data?.loja || data?.nome || "nossa loja").trim();
}

/** Clientes deste telefone: o vinculado à conversa e os cadastrados com o mesmo número. */
async function clientesDoNumero(
  empresaId: string,
  clienteVinculado: string | null,
  numero: string,
): Promise<string[]> {
  const mesmos = await clientesComTelefone(empresaId, numero);
  return [...new Set([clienteVinculado, ...mesmos.map((c) => c.id)].filter(Boolean))] as string[];
}

function nomeAparelho(os: { aparelho: string; marca: string | null; modelo: string | null }) {
  return [os.marca, os.modelo].filter(Boolean).join(" ") || os.aparelho;
}

async function ordensDoNumero(
  empresaId: string,
  clienteVinculado: string | null,
  numero: string,
): Promise<robo.OsResumo[]> {
  const clientes = await clientesDoNumero(empresaId, clienteVinculado, numero);
  if (!clientes.length) return [];
  const { data } = await supabaseAdmin
    .from("ordens_servico")
    .select("numero, aparelho, marca, modelo, status, previsao, valor")
    .eq("user_id", empresaId)
    .in("cliente_id", clientes)
    .not("status", "in", "(cancelado,reprovado)")
    .order("created_at", { ascending: false })
    .limit(10);
  const todas = data ?? [];
  // As em andamento; sem nenhuma, a última que já foi entregue.
  const abertas = todas.filter((o) => !STATUS_ENCERRADOS.includes(o.status)).slice(0, 5);
  const escolhidas = abertas.length ? abertas : todas.slice(0, 1);
  return escolhidas.map((o) => ({
    numero: o.numero,
    aparelho: nomeAparelho(o),
    status: o.status,
    statusLabel: statusLabel(o.status),
    previsao: o.previsao,
    valor:
      (o.status === "pronto" || o.status === "aguardando_aprovacao") && Number(o.valor) > 0
        ? brl(Number(o.valor))
        : null,
  }));
}

async function garantiasDoNumero(
  empresaId: string,
  clienteVinculado: string | null,
  numero: string,
  agora: Date,
): Promise<robo.GarantiaResumo[]> {
  const clientes = await clientesDoNumero(empresaId, clienteVinculado, numero);
  if (!clientes.length) return [];
  const hojeBrt = new Date(agora.getTime() - 3 * HORA).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("ordens_servico")
    .select("numero, aparelho, marca, modelo, garantia_vencimento")
    .eq("user_id", empresaId)
    .in("cliente_id", clientes)
    .in("status", STATUS_ENCERRADOS)
    .gte("garantia_vencimento", hojeBrt)
    .order("garantia_vencimento", { ascending: false })
    .limit(5);
  return (data ?? []).map((o) => ({
    numero: o.numero,
    aparelho: nomeAparelho(o),
    vence: o.garantia_vencimento!,
  }));
}
