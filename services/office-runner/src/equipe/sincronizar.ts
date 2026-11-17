// Sincronização dos perfis da Equipe: lê o catálogo, escolhe os itens novos ou
// alterados (sem os editados pelo administrador), pede ao Claude em lotes de até
// 10 e grava os perfis aceitos com edited = false.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { lerFrontMatter, type ItemCatalogo } from "../catalogo.ts";
import type { AgentProfile } from "../tipos.ts";
import type { LimiteDiario } from "./cotaDiaria.ts";
import {
  chaveNome,
  montarPrompt,
  extrairLista,
  validarLote,
  type PerfilDoLote,
  type ResultadoLote,
} from "./sincronizacaoLote.ts";
import {
  TAMANHO_TEXTO_ORIGINAL,
  hashDoConteudo,
  priorizarNaoRejeitados,
  selecionarPendentes,
  type ItemSincronia,
} from "./sincronizacaoSelecao.ts";

export const TAMANHO_LOTE_MAXIMO = 10;

export type RepositorioSincronia = {
  listar(): Promise<AgentProfile[]>;
  salvar(perfil: AgentProfile): Promise<void>;
};

export type RejeicaoSincronia = { agentId: string; motivo: string };

export type ResultadoSincronia = {
  processados: number;
  gravados: number;
  rejeitados: RejeicaoSincronia[];
  restantes: number;
};

export type RespostaSincronia =
  | { ok: true; resultado: ResultadoSincronia }
  | { ok: false; status: 409 | 429 | 503; erro: string };

export type OpcoesSincronizador = {
  claudeHome: string;
  catalogo: () => Promise<ItemCatalogo[]>;
  repositorio: RepositorioSincronia | undefined;
  gerar: (prompt: string) => Promise<string>;
  cota: LimiteDiario;
};

export type Sincronizador = { executar(tamanho: number): Promise<RespostaSincronia> };

export function criarSincronizador(opcoes: OpcoesSincronizador): Sincronizador {
  let emExecucao = false;
  const rejeitadosAntes = new Set<string>();

  async function executar(tamanho: number): Promise<RespostaSincronia> {
    const repositorio = opcoes.repositorio;
    if (!repositorio) {
      return { ok: false, status: 503, erro: "A Equipe precisa do banco para sincronizar. Configure SUPABASE_SERVICE_ROLE_KEY no runner." };
    }
    if (emExecucao) return { ok: false, status: 409, erro: "Já há uma sincronização em andamento." };
    emExecucao = true;
    try {
      const salvos = await repositorio.listar();
      const itens = await montarItens(await opcoes.catalogo(), opcoes.claudeHome);
      const aSincronizar = selecionarPendentes(itens, salvos);
      if (aSincronizar.length === 0) {
        return { ok: true, resultado: { processados: 0, gravados: 0, rejeitados: [], restantes: 0 } };
      }
      if (!opcoes.cota.tentar()) {
        return { ok: false, status: 429, erro: "Limite diário de lotes da Equipe atingido. Tente amanhã." };
      }
      const lote = priorizarNaoRejeitados(aSincronizar, rejeitadosAntes).slice(0, Math.min(tamanho, TAMANHO_LOTE_MAXIMO));
      const resultado = await processarLote(lote, salvos, aSincronizar.length, { ...opcoes, repositorio });
      rejeitadosAntes.clear();
      for (const rejeicao of resultado.rejeitados) rejeitadosAntes.add(rejeicao.agentId);
      return { ok: true, resultado };
    } finally {
      emExecucao = false;
    }
  }

  return { executar };
}

type OpcoesLote = Omit<OpcoesSincronizador, "repositorio"> & { repositorio: RepositorioSincronia };

async function processarLote(
  lote: ItemSincronia[],
  salvos: readonly AgentProfile[],
  totalPendentes: number,
  opcoes: OpcoesLote,
): Promise<ResultadoSincronia> {
  const idsDoLote = new Set(lote.map((item) => item.agentId));
  // O nome atual do próprio item não conta como conflito: ele será substituído.
  const nomesOcupados = new Set(salvos.filter((perfil) => !idsDoLote.has(perfil.agentId)).map((perfil) => chaveNome(perfil.displayName)));

  const primeira = await gerarValidado(lote, nomesOcupados, opcoes.gerar);
  const reprovadosPorNome = primeira.rejeitados.filter((rejeicao) => rejeicao.porNome).map((rejeicao) => rejeicao.agentId);
  const retentar = lote.filter((item) => reprovadosPorNome.includes(item.agentId));
  const segunda: ResultadoLote = retentar.length > 0
    ? await gerarValidado(retentar, new Set([...nomesOcupados, ...primeira.aceitos.map((p) => chaveNome(p.displayName))]), opcoes.gerar)
    : { aceitos: [], rejeitados: [] };

  const aceitos = [...primeira.aceitos, ...segunda.aceitos];
  const rejeitados = [...primeira.rejeitados.filter((rejeicao) => !rejeicao.porNome), ...segunda.rejeitados];
  const { gravados, falhas } = await gravarAceitos(aceitos, lote, salvos, opcoes.repositorio);
  return {
    processados: lote.length,
    gravados,
    rejeitados: [...rejeitados.map(({ agentId, motivo }) => ({ agentId, motivo })), ...falhas],
    restantes: totalPendentes - gravados,
  };
}

async function gerarValidado(
  itens: readonly ItemSincronia[],
  nomesOcupados: ReadonlySet<string>,
  gerar: (prompt: string) => Promise<string>,
): Promise<ResultadoLote> {
  const ids = new Set(itens.map((item) => item.agentId));
  const texto = await gerar(montarPrompt(itens, [...nomesOcupados]));
  const lista = extrairLista(texto);
  if (!lista) {
    return { aceitos: [], rejeitados: itens.map((item) => ({ agentId: item.agentId, motivo: "resposta sem JSON válido", porNome: false })) };
  }
  return validarLote(lista, ids, nomesOcupados);
}

async function gravarAceitos(
  aceitos: readonly PerfilDoLote[],
  lote: readonly ItemSincronia[],
  salvos: readonly AgentProfile[],
  repositorio: RepositorioSincronia,
): Promise<{ gravados: number; falhas: RejeicaoSincronia[] }> {
  const itemPorId = new Map(lote.map((item) => [item.agentId, item] as const));
  const salvoPorId = new Map(salvos.map((perfil) => [perfil.agentId, perfil] as const));
  const falhas: RejeicaoSincronia[] = [];
  let gravados = 0;
  for (const gerado of aceitos) {
    const item = itemPorId.get(gerado.agentId);
    if (!item) continue;
    const aparencia = salvoPorId.get(gerado.agentId)?.appearance ?? { seed: gerado.agentId };
    try {
      await repositorio.salvar(montarPerfil(gerado, item, aparencia));
      gravados += 1;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "erro desconhecido";
      falhas.push({ agentId: gerado.agentId, motivo: `falha ao gravar: ${mensagem}` });
    }
  }
  return { gravados, falhas };
}

export function montarPerfil(gerado: PerfilDoLote, item: ItemSincronia, aparencia: AgentProfile["appearance"]): AgentProfile {
  return {
    agentId: gerado.agentId,
    kind: item.kind,
    displayName: gerado.displayName,
    roleTitle: gerado.roleTitle,
    summaryPtBr: gerado.summaryPtBr,
    descriptionPtBr: gerado.descriptionPtBr,
    whenToUse: gerado.whenToUse,
    sector: item.setor,
    appearance: aparencia,
    originalDescription: item.textoOriginal,
    sourceHash: item.sourceHash,
    edited: false,
  };
}

/** Lê o texto original de cada item: o .md do agente, ou nome + descrição da skill. */
export async function montarItens(catalogo: readonly ItemCatalogo[], claudeHome: string): Promise<ItemSincronia[]> {
  return Promise.all(
    catalogo.map(async (item): Promise<ItemSincronia> => {
      const conteudo = await lerConteudoOriginal(item, claudeHome);
      return {
        agentId: item.id,
        kind: item.tipo === "skill" ? "skill" : "agent",
        setor: item.setor,
        textoOriginal: conteudo.slice(0, TAMANHO_TEXTO_ORIGINAL),
        sourceHash: hashDoConteudo(conteudo),
      };
    }),
  );
}

async function lerConteudoOriginal(item: ItemCatalogo, claudeHome: string): Promise<string> {
  if (item.tipo === "agente") return lerArquivoOpcional(join(claudeHome, "agents", `${item.id}.md`));
  const skill = await lerArquivoOpcional(join(claudeHome, "skills", item.id, "SKILL.md"));
  const descricao = lerFrontMatter(skill).descricao ?? "";
  return `${item.id}\n${descricao}`;
}

async function lerArquivoOpcional(caminho: string): Promise<string> {
  try {
    return await readFile(caminho, "utf8");
  } catch (erro) {
    if (erro instanceof Error && "code" in erro && erro.code === "ENOENT") return "";
    throw erro;
  }
}
