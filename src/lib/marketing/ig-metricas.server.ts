// Coleta e leitura das métricas do Instagram no servidor. Usa a Página já
// conectada (lerContas) e grava com o service role (ig-metricas.db.server.ts).
import { lerContas, type ContasMeta } from "./meta.server";
import { normalizarMidia, type MidiaBruta } from "./ig-metricas.normalizar";
import {
  buscarConta,
  buscarInsightsConta,
  buscarMidias,
  buscarMidiasBasicas,
  buscarSeguidoresDiarios,
  ehErroDeCampoOuPermissao,
  ehErroDePermissao,
  type InsightsContaBruto,
} from "./ig-metricas.graph";
import { diaBrasil, seguidoresValidos, type PostMetricas } from "./ig-metricas.calc";
import {
  concluirColetaManual,
  DIAS_HISTORICO_MIDIAS,
  gravarColetaDiaria,
  lerDiaMaisRecenteMidias,
  lerLinhasConta,
  lerMidiasDoDia,
  lerUltimaColeta,
  podarHistorico,
  reservarColetaManual,
  upsertLinhas,
  type ReservaManual,
} from "./ig-metricas.db.server";

const MENSAGEM_PARCIAL =
  "Coleta parcial: falta permissão de insights. Reconecte a Página pedindo instagram_manage_insights.";
const LIMITE_POSTS_PAINEL = 50;
/** A Meta marca o fim do dia (ex.: 07:00 UTC do dia seguinte): recua 12h para cair no dia certo em Brasília. */
const HORAS_RECUO_FECHAMENTO = 12;

export type ResultadoColeta = {
  permissoesOk: boolean;
  midias: number;
  seguidores: number | null;
  mensagem: string;
};

export type PainelInstagram = {
  conectado: boolean;
  usuario: string | null;
  seguidoresAtuais: number | null;
  conta: {
    dia: string;
    seguidores: number | null;
    alcance: number | null;
    visitasPerfil: number | null;
    cliquesLink: number | null;
  }[];
  midias: PostMetricas[];
  ultimaColeta: {
    executadoEm: string;
    ok: boolean;
    mensagem: string | null;
    permissoesOk: boolean;
  } | null;
};

export type ResultadoManual =
  { ok: true; permissoesOk: boolean; mensagem: string } | { ok: false; esperarSegundos: number };

function paginaConectada(contas: ContasMeta | null) {
  const pagina = contas?.paginas.find((p) => p.id === contas.paginaId);
  if (!pagina?.instagram)
    throw new Error("Conecte uma Página com Instagram comercial na aba Contas.");
  return { token: pagina.token, igUserId: pagina.instagram.id, usuario: pagina.instagram.usuario };
}

function diaDoFechamento(fimIso: string): string {
  return diaBrasil(new Date(Date.parse(fimIso) - HORAS_RECUO_FECHAMENTO * 3_600_000));
}

function valorTotal(insights: InsightsContaBruto, nome: string): number | null {
  const item = insights.data.find((m) => m.name === nome);
  const valor = item?.total_value?.value;
  return typeof valor === "number" ? valor : null;
}

async function coletarSeguidoresDiarios(igUserId: string, token: string): Promise<boolean> {
  try {
    const serie = await buscarSeguidoresDiarios(igUserId, token);
    const linhas = seguidoresValidos(serie.data[0]?.values ?? [])
      .filter((v): v is typeof v & { end_time: string } => Boolean(v.end_time))
      .map((v) => ({
        ig_user_id: igUserId,
        dia: diaDoFechamento(v.end_time),
        seguidores: v.value,
      }));
    await upsertLinhas("ig_conta_diaria", linhas, "ig_user_id,dia");
    return true;
  } catch (erro) {
    if (ehErroDePermissao(erro)) return false;
    throw erro;
  }
}

async function coletarInsightsDeHoje(
  igUserId: string,
  token: string,
  dia: string,
  seguidores: number | null,
): Promise<boolean> {
  const base = { ig_user_id: igUserId, dia, seguidores };
  try {
    const insights = await buscarInsightsConta(igUserId, token);
    await upsertLinhas(
      "ig_conta_diaria",
      [
        {
          ...base,
          alcance: valorTotal(insights, "reach"),
          visitas_perfil: valorTotal(insights, "profile_views"),
          cliques_link: valorTotal(insights, "website_clicks"),
        },
      ],
      "ig_user_id,dia",
    );
    return true;
  } catch (erro) {
    if (!ehErroDePermissao(erro)) throw erro;
    await upsertLinhas("ig_conta_diaria", [base], "ig_user_id,dia");
    return false;
  }
}

async function coletarMidias(
  igUserId: string,
  token: string,
  dia: string,
): Promise<{ ok: boolean; total: number }> {
  let bruta: { data: MidiaBruta[] };
  let ok = true;
  try {
    bruta = await buscarMidias(igUserId, token);
  } catch (erro) {
    // Métricas aninhadas recusadas (permissão ou métrica não suportada): grava as
    // contagens básicas. Erro de rede ou de limite de uso sobe sem ser confundido com permissão.
    if (!ehErroDeCampoOuPermissao(erro)) throw erro;
    bruta = await buscarMidiasBasicas(igUserId, token);
    ok = false;
  }
  const linhas = bruta.data.map((m) => {
    const p = normalizarMidia(m);
    return {
      ig_media_id: p.id,
      ig_user_id: igUserId,
      dia_coleta: dia,
      tipo: p.tipo,
      publicado_em: m.timestamp ?? null,
      legenda: p.legenda,
      miniatura_url: p.miniatura,
      permalink: p.permalink,
      alcance: p.alcance,
      curtidas: p.curtidas,
      comentarios: p.comentarios,
      salvamentos: p.salvamentos,
      compartilhamentos: p.compartilhamentos,
      visualizacoes: p.visualizacoes,
    };
  });
  await upsertLinhas("ig_midia_metricas", linhas, "ig_media_id,dia_coleta");
  return { ok, total: linhas.length };
}

/** Coleta completa. Falta de permissão de insights não lança erro: marca `permissoesOk=false`. */
async function executarColeta(
  igUserId: string,
  token: string,
  agora: Date,
): Promise<ResultadoColeta> {
  const hoje = diaBrasil(agora);
  const conta = await buscarConta(igUserId, token);
  const seguidores = conta.followers_count ?? null;
  const seriePermitida = await coletarSeguidoresDiarios(igUserId, token);
  const insightsPermitidos = await coletarInsightsDeHoje(igUserId, token, hoje, seguidores);
  const midias = await coletarMidias(igUserId, token, hoje);
  await podarHistorico(agora);

  const permissoesOk = seriePermitida && insightsPermitidos && midias.ok;
  return {
    permissoesOk,
    midias: midias.total,
    seguidores,
    mensagem: permissoesOk ? `Coleta concluída: ${midias.total} posts.` : MENSAGEM_PARCIAL,
  };
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Falha desconhecida na coleta.";
}

/** Coleta diária (script de servidor). Erros são registrados e sobem para o código de saída. */
export async function coletarDiaria(agora: Date = new Date()): Promise<ResultadoColeta> {
  const { token, igUserId } = paginaConectada(await lerContas());
  try {
    const resultado = await executarColeta(igUserId, token, agora);
    await gravarColetaDiaria(igUserId, true, resultado.mensagem, {
      permissoes_ok: resultado.permissoesOk,
      midias: resultado.midias,
      seguidores: resultado.seguidores,
    });
    return resultado;
  } catch (erro) {
    try {
      await gravarColetaDiaria(igUserId, false, mensagemDeErro(erro), {});
    } catch (erroLog) {
      console.error("ig-coleta: falha ao registrar no log", erroLog);
    }
    throw erro;
  }
}

/** Botão "Atualizar agora": no máximo uma coleta a cada 10 minutos, com reserva no banco. */
export async function executarColetaManual(agora: Date): Promise<ResultadoManual> {
  const { token, igUserId } = paginaConectada(await lerContas());
  const reserva: ReservaManual = await reservarColetaManual(igUserId, agora);
  if (!reserva.reservada) return { ok: false, esperarSegundos: reserva.esperarSegundos };

  try {
    const resultado = await executarColeta(igUserId, token, agora);
    await concluirColetaManual(reserva.id, true, resultado.mensagem, {
      permissoes_ok: resultado.permissoesOk,
      midias: resultado.midias,
      seguidores: resultado.seguidores,
    });
    return { ok: true, permissoesOk: resultado.permissoesOk, mensagem: resultado.mensagem };
  } catch (erro) {
    try {
      await concluirColetaManual(reserva.id, false, mensagemDeErro(erro), {});
    } catch (erroLog) {
      console.error("ig-coleta: falha ao concluir a reserva", erroLog);
    }
    throw erro;
  }
}

/** Painel: lê só o que o servidor já gravou (não chama a Meta). */
export async function lerPainelInstagram(): Promise<PainelInstagram> {
  const contas = await lerContas();
  const pagina = contas?.paginas.find((p) => p.id === contas.paginaId);
  if (!pagina?.instagram) {
    return {
      conectado: false,
      usuario: null,
      seguidoresAtuais: null,
      conta: [],
      midias: [],
      ultimaColeta: null,
    };
  }
  const igUserId = pagina.instagram.id;
  const desde = diaBrasil(new Date(Date.now() - DIAS_HISTORICO_MIDIAS * 86_400_000));
  const linhasConta = await lerLinhasConta(igUserId, desde);
  const diaMidias = await lerDiaMaisRecenteMidias(igUserId);
  const linhasMidia = diaMidias
    ? await lerMidiasDoDia(igUserId, diaMidias, LIMITE_POSTS_PAINEL)
    : [];
  const ultimo = await lerUltimaColeta(igUserId);

  const conta = linhasConta.map((l) => ({
    dia: String(l["dia"]),
    seguidores: (l["seguidores"] as number | null) ?? null,
    alcance: (l["alcance"] as number | null) ?? null,
    visitasPerfil: (l["visitas_perfil"] as number | null) ?? null,
    cliquesLink: (l["cliques_link"] as number | null) ?? null,
  }));
  const ultimoComSeguidores = [...conta].reverse().find((c) => c.seguidores !== null);

  return {
    conectado: true,
    usuario: pagina.instagram.usuario,
    seguidoresAtuais: ultimoComSeguidores?.seguidores ?? null,
    conta,
    midias: linhasMidia.map(linhaParaPost),
    ultimaColeta: ultimo
      ? {
          executadoEm: ultimo.executado_em,
          ok: ultimo.ok,
          mensagem: ultimo.mensagem,
          permissoesOk: ultimo.ok && ultimo.detalhes?.permissoes_ok !== false,
        }
      : null,
  };
}

function linhaParaPost(l: Record<string, unknown>): PostMetricas {
  const numero = (v: unknown): number | null => (typeof v === "number" ? v : null);
  const publicadoEm = typeof l["publicado_em"] === "string" ? l["publicado_em"] : null;
  return {
    id: String(l["ig_media_id"]),
    tipo: String(l["tipo"] ?? "IMAGE"),
    data: publicadoEm ? diaBrasil(new Date(publicadoEm)) : "",
    legenda: String(l["legenda"] ?? ""),
    miniatura: (l["miniatura_url"] as string | null) ?? null,
    permalink: (l["permalink"] as string | null) ?? null,
    alcance: numero(l["alcance"]),
    curtidas: numero(l["curtidas"]) ?? 0,
    comentarios: numero(l["comentarios"]) ?? 0,
    salvamentos: numero(l["salvamentos"]),
    compartilhamentos: numero(l["compartilhamentos"]),
    visualizacoes: numero(l["visualizacoes"]),
  };
}
