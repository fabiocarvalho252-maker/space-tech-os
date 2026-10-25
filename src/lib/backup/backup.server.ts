// Backups no Google Drive (conexão em google-drive.server.ts).
//
// - Empresa: ZIP com todos os dados da empresa (um JSON e uma planilha CSV
//   por tabela) e, se marcado, as fotos e PDFs do Storage. Feito pelo botão
//   "Fazer backup agora" em Configurações → Backup ou todo dia pela rotina
//   automática. Ficam os 14 mais novos na pasta "SPACE TECH - Backup".
// - Plataforma: os arquivos que scripts/backup-banco.sh acabou de gerar em
//   /root/backups/banco (dump completo do Postgres + Storage), enviados para o
//   Drive que o operador conectou no /admin. Ficam os 7 mais novos de cada.
//
// A rotina diária é POST /api/backup-drive/cron (cron-handler.server.ts),
// chamada pelo próprio backup-banco.sh logo depois do backup local.
// Server-only.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  GoogleDriveError,
  apagarAntigos,
  enviarArquivo,
  garantirPasta,
  tokenDeAcesso,
} from "./google-drive.server";

export const ID_PLATAFORMA = "plataforma";
const PASTA_EMPRESA = "SPACE TECH - Backup";
const PASTA_PLATAFORMA = "SPACE TECH - Backup do servidor";
const MANTER_EMPRESA = 14;
const MANTER_PLATAFORMA = 7;
const DIR_LOCAL = "/root/backups/banco";
const PAGINA = 1000;
// Acima disso as fotos ficam fora do ZIP (o resto do backup ainda sai).
const LIMITE_FOTOS_BYTES = 1024 * 1024 * 1024;
// A rotina automática pula quem já fez backup nas últimas horas (ex.: manual).
const INTERVALO_AUTOMATICO_MS = 20 * 3_600_000;

export type ResultadoBackup = { arquivo: string; tamanho: number; apagados: number };

const emAndamento = new Set<string>();

function carimbo(d = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}_${v("hour")}${v("minute")}`;
}

function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "empresa"
  );
}

function celulaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Separador ";" e BOM: é o que o Excel em português abre direto, com acentos.
function paraCsv(linhas: Record<string, unknown>[]): string {
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const corpo = linhas.map((l) => colunas.map((c) => celulaCsv(l[c])).join(";"));
  return "\uFEFF" + [colunas.join(";"), ...corpo].join("\r\n");
}

async function lerTabela(
  tabela: string,
  coluna: string,
  empresaId: string,
): Promise<Record<string, unknown>[]> {
  // Nome de tabela dinâmico (vem de backup_tabelas_empresa), fora dos tipos gerados.
  const cliente = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => {
          range: (
            a: number,
            b: number,
          ) => Promise<{ data: Record<string, unknown>[] | null; error: Error | null }>;
        };
      };
    };
  };
  const linhas: Record<string, unknown>[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await cliente
      .from(tabela)
      .select("*")
      .eq(coluna, empresaId)
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

export async function gerarZipEmpresa(
  empresaId: string,
  incluirFotos: boolean,
): Promise<{ zip: Buffer; loja: string }> {
  const { data: perfil, error: erroPerfil } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", empresaId)
    .maybeSingle();
  if (erroPerfil) throw erroPerfil;
  if (!perfil) throw new Error("Empresa não encontrada.");
  const loja = perfil.loja || perfil.nome || "empresa";

  const { data: tabelas, error: erroTabelas } = await supabaseAdmin.rpc("backup_tabelas_empresa");
  if (erroTabelas) throw erroTabelas;

  const zip = new JSZip();
  const resumo: string[] = [];
  const adicionar = (nome: string, linhas: Record<string, unknown>[]) => {
    zip.file(`dados/${nome}.json`, JSON.stringify(linhas, null, 2));
    if (linhas.length) zip.file(`planilhas/${nome}.csv`, paraCsv(linhas));
    resumo.push(`${nome}: ${linhas.length}`);
  };

  adicionar("empresa", [perfil]);
  adicionar("role_permissions", await lerTabela("role_permissions", "empresa_id", empresaId));
  for (const tabela of tabelas ?? []) {
    adicionar(tabela, await lerTabela(tabela, "user_id", empresaId));
  }

  let notaFotos = "Fotos e documentos: não incluídos (opção desmarcada).";
  if (incluirFotos) {
    const { data: arquivos, error } = await supabaseAdmin.rpc("backup_arquivos_empresa", {
      p_empresa: empresaId,
    });
    if (error) throw error;
    const total = (arquivos ?? []).reduce((s, a) => s + Number(a.tamanho), 0);
    if (total > LIMITE_FOTOS_BYTES) {
      notaFotos = `Fotos e documentos: não incluídos — passam de 1 GB (${(total / 1024 ** 3).toFixed(1)} GB).`;
    } else {
      let falhas = 0;
      for (const a of arquivos ?? []) {
        const { data: blob } = await supabaseAdmin.storage.from(a.bucket_id).download(a.name);
        if (!blob) {
          falhas++;
          continue;
        }
        // Imagens e PDFs já vêm comprimidos: guardar sem recomprimir.
        zip.file(`fotos/${a.bucket_id}/${a.name}`, Buffer.from(await blob.arrayBuffer()), {
          compression: "STORE",
        });
      }
      notaFotos = `Fotos e documentos: ${(arquivos?.length ?? 0) - falhas} arquivo(s)${falhas ? `, ${falhas} não puderam ser lidos` : ""}.`;
    }
  }

  zip.file(
    "LEIA-ME.txt",
    [
      `Backup SPACE TECH OS — ${loja}`,
      `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Bahia" })}`,
      "",
      "planilhas/  uma planilha por tabela (abre no Excel ou Google Planilhas)",
      "dados/      os mesmos dados em JSON, completos, para restauração",
      "fotos/      fotos das OS, aparelhos, seminovos e o logo",
      "",
      "Senhas e chaves de integração (Mercado Pago, e-mail, WhatsApp) não entram no backup.",
      "",
      notaFotos,
      "",
      "Registros por tabela:",
      ...resumo.map((r) => `  ${r}`),
    ].join("\r\n"),
  );

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { zip: buffer, loja };
}

async function registrar(
  id: string,
  resultado: { ok: ResultadoBackup } | { erro: unknown },
): Promise<void> {
  const agora = new Date().toISOString();
  const campos =
    "ok" in resultado
      ? {
          ultimo_status: "ok",
          ultimo_erro: null,
          ultimo_arquivo: resultado.ok.arquivo,
          ultimo_tamanho: resultado.ok.tamanho,
        }
      : {
          ultimo_status: "erro",
          ultimo_erro:
            resultado.erro instanceof Error ? resultado.erro.message : String(resultado.erro),
        };
  await supabaseAdmin
    .from("backup_google_drive")
    .update({ ...campos, ultimo_backup_em: agora, updated_at: agora })
    .eq("id", id);
}

async function comConexao(
  id: string,
  nomePasta: string,
  executar: (
    token: string,
    pastaId: string,
    conexao: { incluir_fotos: boolean },
  ) => Promise<ResultadoBackup>,
): Promise<ResultadoBackup> {
  if (emAndamento.has(id)) throw new Error("Já existe um backup em andamento. Aguarde terminar.");
  emAndamento.add(id);
  try {
    const { data: conexao, error } = await supabaseAdmin
      .from("backup_google_drive")
      .select("refresh_token, pasta_id, incluir_fotos")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!conexao) throw new Error("Google Drive não conectado.");
    try {
      const token = await tokenDeAcesso(conexao.refresh_token);
      const pastaId = await garantirPasta(token, conexao.pasta_id, nomePasta);
      if (pastaId !== conexao.pasta_id) {
        await supabaseAdmin.from("backup_google_drive").update({ pasta_id: pastaId }).eq("id", id);
      }
      const resultado = await executar(token, pastaId, conexao);
      await registrar(id, { ok: resultado });
      return resultado;
    } catch (erro) {
      await registrar(id, { erro });
      throw erro;
    }
  } finally {
    emAndamento.delete(id);
  }
}

export function backupEmpresa(empresaId: string): Promise<ResultadoBackup> {
  return comConexao(empresaId, PASTA_EMPRESA, async (token, pastaId, conexao) => {
    const { zip, loja } = await gerarZipEmpresa(empresaId, conexao.incluir_fotos);
    const nome = `backup-${slug(loja)}-${carimbo()}.zip`;
    const enviado = await enviarArquivo(token, pastaId, nome, "application/zip", { buffer: zip });
    const apagados = await apagarAntigos(token, pastaId, ["backup-"], MANTER_EMPRESA);
    return { arquivo: enviado.name, tamanho: enviado.size, apagados };
  });
}

async function maisNovo(prefixo: string): Promise<{ nome: string; tamanho: number } | null> {
  const nomes = (await readdir(DIR_LOCAL).catch(() => []))
    .filter((n) => n.startsWith(prefixo) && n.endsWith(".gz"))
    .sort();
  const nome = nomes.at(-1);
  if (!nome) return null;
  return { nome, tamanho: (await stat(join(DIR_LOCAL, nome))).size };
}

export function backupPlataforma(): Promise<ResultadoBackup> {
  return comConexao(ID_PLATAFORMA, PASTA_PLATAFORMA, async (token, pastaId) => {
    const banco = await maisNovo("banco-");
    if (!banco) throw new Error(`Nenhum backup local em ${DIR_LOCAL}.`);
    const storage = await maisNovo("storage-");
    let tamanho = 0;
    for (const arq of [banco, storage]) {
      if (!arq) continue;
      const enviado = await enviarArquivo(token, pastaId, arq.nome, "application/gzip", {
        caminho: join(DIR_LOCAL, arq.nome),
        tamanho: arq.tamanho,
      });
      tamanho += enviado.size;
    }
    const apagados = await apagarAntigos(token, pastaId, ["banco-", "storage-"], MANTER_PLATAFORMA);
    return { arquivo: banco.nome, tamanho, apagados };
  });
}

export type ResultadoRotina = {
  plataforma: ResultadoBackup | { erro: string } | null;
  empresas: { id: string; ok: boolean; erro?: string }[];
};

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/** Rotina diária: plataforma + toda empresa com backup automático ligado. */
export async function rodarBackupsAgendados(): Promise<ResultadoRotina> {
  const { data: conexoes, error } = await supabaseAdmin
    .from("backup_google_drive")
    .select("id, automatico, ultimo_backup_em");
  if (error) throw error;

  const resultado: ResultadoRotina = { plataforma: null, empresas: [] };
  if (conexoes?.some((c) => c.id === ID_PLATAFORMA)) {
    resultado.plataforma = await backupPlataforma().catch((e: unknown) => ({ erro: mensagem(e) }));
  }

  const limite = Date.now() - INTERVALO_AUTOMATICO_MS;
  for (const c of conexoes ?? []) {
    if (c.id === ID_PLATAFORMA || !c.automatico) continue;
    if (c.ultimo_backup_em && new Date(c.ultimo_backup_em).getTime() > limite) continue;
    try {
      await backupEmpresa(c.id);
      resultado.empresas.push({ id: c.id, ok: true });
    } catch (e) {
      // Acesso revogado continua registrado como erro na tela da empresa.
      if (!(e instanceof GoogleDriveError && e.acessoRevogado)) {
        console.error(`[Backup Drive] Empresa ${c.id}:`, mensagem(e));
      }
      resultado.empresas.push({ id: c.id, ok: false, erro: mensagem(e) });
    }
  }
  return resultado;
}
