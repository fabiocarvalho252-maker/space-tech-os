// Agenda de publicações do /admin/marketing. Fica em marketing/agenda.json
// (texto, como o resto da pasta). O administrador agenda um conteúdo APROVADO
// para Instagram e/ou Facebook em uma data e hora; o worker
// (scripts/marketing-agenda-worker.mjs, a cada minuto pelo crontab) publica o
// que chegou na hora usando a mesma função do botão "Publicar"
// (publicacao.server.ts), que confere de novo aprovação, plataforma e arquivo.
import { appendFile, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  jaPublicadoEm,
  lerConteudoMarketing,
  plataformasPublicaveis,
  textoUmaLinha,
  type PlataformaMeta,
} from "./conteudo";
import { agoraBR } from "./decisao.server";
import { lerContas } from "./meta.server";
import { assinarMidias } from "./midia.server";

export type StatusAgenda = "agendado" | "executando" | "publicado" | "falhou" | "cancelado";

export type ResultadoAgenda = { link?: string; erro?: string };

export type ItemAgenda = {
  id: string;
  conteudo: string;
  titulo: string;
  plataformas: PlataformaMeta[];
  // Horário de Brasília com offset explícito (ex.: 2026-11-20T12:00:00-03:00).
  quando: string;
  // Data de alteração do arquivo no momento do agendamento. Se o conteúdo for
  // alterado antes da hora, a publicação para e avisa.
  versao: string;
  status: StatusAgenda;
  criadoEm: string;
  criadoPor: string;
  executadoEm: string | null;
  resultados: Partial<Record<PlataformaMeta, ResultadoAgenda>>;
};

export type Agenda = { itens: ItemAgenda[] };

const raiz = () => join(process.cwd(), "marketing");
const ARQUIVO = "agenda.json";
const FUSO = "-03:00"; // Brasil não usa horário de verão desde 2019.
const ANTECEDENCIA_MIN_MS = 2 * 60 * 1000;
const HORIZONTE_MS = 365 * 24 * 3600 * 1000;

const MENSAGEM_ALTERADO =
  "O conteúdo foi alterado depois de agendado. Confira o arquivo e agende de novo.";

export async function lerAgenda(): Promise<Agenda> {
  try {
    const texto = await readFile(join(raiz(), ARQUIVO), "utf8");
    const dados = JSON.parse(texto) as Partial<Agenda>;
    return { itens: Array.isArray(dados.itens) ? dados.itens : [] };
  } catch {
    return { itens: [] };
  }
}

// Escrita atômica: grava em um arquivo temporário e troca no lugar.
export async function salvarAgenda(a: Agenda): Promise<void> {
  const alvo = join(raiz(), ARQUIVO);
  const tmp = `${alvo}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(a, null, 2)}\n`, "utf8");
  await rename(tmp, alvo);
}

// Converte "2026-11-20T12:00" (horário de Brasília) em ISO com offset.
export function quandoParaIso(quando: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando)) throw new Error("Data ou hora inválida.");
  return `${quando}:00${FUSO}`;
}

async function acharAprovado(
  id: string,
): Promise<{ caminho: string; nome: string; mtime: string; texto: string }> {
  const nomes = await readdir(join(raiz(), "aprovados")).catch(() => [] as string[]);
  const nome = nomes.find((n) => n.startsWith(`${id}-`) && n.endsWith(".md"));
  if (!nome) throw new Error(`O ${id} não está aprovado. Atualize a página.`);
  const caminho = join(raiz(), "aprovados", nome);
  const info = await stat(caminho);
  const texto = await readFile(caminho, "utf8");
  return { caminho, nome, mtime: info.mtime.toISOString(), texto };
}

export async function agendarConteudo(d: {
  conteudo: string;
  plataformas: PlataformaMeta[];
  quando: string;
  email: string;
}): Promise<ItemAgenda> {
  const quando = quandoParaIso(d.quando);
  const momento = Date.parse(quando);
  const agora = Date.now();
  if (Number.isNaN(momento)) throw new Error("Data ou hora inválida.");
  if (momento < agora + ANTECEDENCIA_MIN_MS)
    throw new Error("Escolha um horário pelo menos 2 minutos à frente.");
  if (momento > agora + HORIZONTE_MS) throw new Error("Agende com até 1 ano de antecedência.");

  const plataformas = [...new Set(d.plataformas)];
  if (!plataformas.length) throw new Error("Marque ao menos uma plataforma.");

  const a = await acharAprovado(d.conteudo);
  const c = lerConteudoMarketing(a.texto, "aprovados", a.nome, a.mtime);
  const autorizadas = plataformasPublicaveis(c);
  for (const p of plataformas) {
    if (!autorizadas.includes(p))
      throw new Error(
        `${p === "instagram" ? "Instagram" : "Facebook"} não foi autorizado na aprovação deste conteúdo.`,
      );
    if (jaPublicadoEm(a.texto, p))
      throw new Error(
        `Este conteúdo já foi publicado no ${p === "instagram" ? "Instagram" : "Facebook"}.`,
      );
  }

  const agenda = await lerAgenda();
  for (const item of agenda.itens) {
    if (
      item.conteudo !== d.conteudo ||
      (item.status !== "agendado" && item.status !== "executando")
    )
      continue;
    const repetida = item.plataformas.filter((p) => plataformas.includes(p));
    if (repetida.length)
      throw new Error(
        `${d.conteudo} já está agendado para ${repetida.join(", ")} (${item.quando}).`,
      );
  }

  const contas = await lerContas();
  if (!contas?.paginas.find((p) => p.id === contas.paginaId))
    throw new Error("Conecte o Instagram e o Facebook e escolha a Página na aba Contas.");

  const m = await assinarMidias(d.conteudo, 60);
  if (!m.video && !m.slides?.length)
    throw new Error("Gere a imagem ou o vídeo deste conteúdo antes de agendar.");

  const item: ItemAgenda = {
    id: `ag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    conteudo: d.conteudo,
    titulo: c.titulo,
    plataformas,
    quando,
    versao: a.mtime,
    status: "agendado",
    criadoEm: new Date().toISOString(),
    criadoPor: d.email,
    executadoEm: null,
    resultados: {},
  };
  agenda.itens.push(item);
  await salvarAgenda(agenda);
  await appendFile(
    join(raiz(), "registro-decisoes.md"),
    `| ${agoraBR()} | ${d.conteudo} | AGENDADO | ${plataformas.join(", ")} | para ${textoUmaLinha(agoraBR(new Date(momento)))} | ${textoUmaLinha(d.email)} |\n`,
    "utf8",
  );
  return item;
}

export async function cancelarAgendamento(id: string, email: string): Promise<void> {
  const agenda = await lerAgenda();
  const item = agenda.itens.find((i) => i.id === id);
  if (!item) throw new Error("Agendamento não encontrado. Atualize a página.");
  if (item.status !== "agendado")
    throw new Error("Só dá para cancelar um agendamento que ainda não foi executado.");
  item.status = "cancelado";
  await salvarAgenda(agenda);
  await appendFile(
    join(raiz(), "registro-decisoes.md"),
    `| ${agoraBR()} | ${item.conteudo} | AGENDAMENTO CANCELADO | ${item.plataformas.join(", ")} | ${textoUmaLinha(item.id)} | ${textoUmaLinha(email)} |\n`,
    "utf8",
  );
}

// Altera um item relendo o arquivo antes, para não sobrescrever outra mudança.
async function atualizarItem(id: string, mudar: (i: ItemAgenda) => void): Promise<void> {
  const agenda = await lerAgenda();
  const item = agenda.itens.find((i) => i.id === id);
  if (!item) return;
  mudar(item);
  await salvarAgenda(agenda);
}

const NOME: Record<PlataformaMeta, string> = { instagram: "Instagram", facebook: "Facebook" };

// Executa os agendamentos vencidos. Chamado pelo worker. Cada item muda para
// "executando" antes de publicar, então uma segunda execução não repete.
export async function executarAgendados(agora = new Date()): Promise<string[]> {
  const log: string[] = [];
  const agenda = await lerAgenda();
  const vencidos = agenda.itens.filter(
    (i) => i.status === "agendado" && Date.parse(i.quando) <= agora.getTime(),
  );
  const { publicarConteudo } = await import("./publicacao.server");

  for (const vencido of vencidos) {
    await atualizarItem(vencido.id, (i) => {
      i.status = "executando";
    });
    const resultados: ItemAgenda["resultados"] = {};
    let versao = vencido.versao;
    let ok = true;

    for (const p of vencido.plataformas) {
      if (!ok) {
        resultados[p] = {
          erro: "Não tentado: uma publicação anterior do mesmo agendamento falhou.",
        };
        continue;
      }
      try {
        const r = await publicarConteudo({
          id: vencido.conteudo,
          plataforma: p,
          versao,
          email: vencido.criadoPor,
        });
        resultados[p] = { link: r.link };
        log.push(`${vencido.conteudo} ${NOME[p]} OK ${r.link}`);
        // A publicação reescreve o arquivo: a próxima plataforma usa a nova versão.
        const info = await stat(join(raiz(), "publicados", await nomeDe(vencido.conteudo))).catch(
          () => null,
        );
        versao = info ? info.mtime.toISOString() : versao;
      } catch (e) {
        ok = false;
        const erro = e instanceof Error ? e.message : String(e);
        resultados[p] = { erro: erro.includes("alterado") ? MENSAGEM_ALTERADO : erro };
        log.push(`${vencido.conteudo} ${NOME[p]} ERRO ${erro}`);
      }
    }

    await atualizarItem(vencido.id, (i) => {
      i.status = ok ? "publicado" : "falhou";
      i.executadoEm = new Date().toISOString();
      i.resultados = resultados;
    });
  }
  return log;
}

async function nomeDe(id: string): Promise<string> {
  const nomes = await readdir(join(raiz(), "publicados")).catch(() => [] as string[]);
  return nomes.find((n) => n.startsWith(`${id}-`) && n.endsWith(".md")) ?? "";
}
