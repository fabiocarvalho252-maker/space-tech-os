// Grava a decisão do administrador (aprovar / recusar) nos arquivos de
// marketing/: troca o status e o bloco "Aprovação", move o arquivo para a
// pasta do novo status e acrescenta uma linha em registro-decisoes.md.
// Nunca publica nada. Só aceita conteúdos em aprovacao/ e confere que o
// arquivo é o mesmo que o administrador estava vendo (data de alteração).
import { readFile, readdir, rename, stat, unlink, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import {
  aplicarAprovacao,
  aplicarRecusa,
  lerConteudoMarketing,
  opcoesPlataforma,
  textoUmaLinha,
} from "./conteudo";

const REGISTRO = "registro-decisoes.md";
const CABECALHO_REGISTRO = `# Registro de decisões

Cada aprovação ou recusa feita em /admin/marketing entra aqui automaticamente
(uma linha por decisão, nunca apagada pelo sistema).

| Data e hora | ID | Decisão | Plataformas autorizadas | Motivo / observação | Por |
|---|---|---|---|---|---|
`;

function raiz() {
  return join(process.cwd(), "marketing");
}

export function agoraBR(data = new Date()): string {
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function acharArquivo(id: string): Promise<string> {
  const nomes = await readdir(join(raiz(), "aprovacao")).catch(() => [] as string[]);
  const nome = nomes.find((n) => n.startsWith(`${id}-`) && n.endsWith(".md"));
  if (!nome) throw new Error(`O ${id} não está aguardando aprovação (atualize a página).`);
  return nome;
}

async function registrar(linha: string[]) {
  const caminho = join(raiz(), REGISTRO);
  const existe = await stat(caminho)
    .then(() => true)
    .catch(() => false);
  if (!existe) await writeFile(caminho, CABECALHO_REGISTRO, "utf8");
  await appendFile(
    caminho,
    `| ${linha.map((c) => textoUmaLinha(c) || "—").join(" | ")} |\n`,
    "utf8",
  );
}

async function mover(nome: string, novoTexto: string, destino: "aprovados" | "conteudos") {
  const origem = join(raiz(), "aprovacao", nome);
  const alvo = join(raiz(), destino, nome);
  if (
    await stat(alvo)
      .then(() => true)
      .catch(() => false)
  )
    throw new Error(`Já existe um arquivo ${destino}/${nome}.`);
  const temp = `${alvo}.tmp-${process.pid}`;
  await writeFile(temp, novoTexto, "utf8");
  await rename(temp, alvo);
  await unlink(origem);
}

export async function decidirConteudo(d: {
  id: string;
  acao: "aprovar" | "recusar";
  plataformas: string[];
  motivo: string;
  versao: string;
  email: string;
}): Promise<{ status: "APROVADO" | "RASCUNHO" }> {
  const nome = await acharArquivo(d.id);
  const caminho = join(raiz(), "aprovacao", nome);
  const info = await stat(caminho);
  if (info.mtime.toISOString() !== d.versao)
    throw new Error(
      "O conteúdo foi alterado desde que você abriu. Atualize a página e confira de novo.",
    );
  const texto = await readFile(caminho, "utf8");
  const c = lerConteudoMarketing(texto, "aprovacao", nome);
  if (c.status !== "AGUARDANDO APROVAÇÃO")
    throw new Error("Status do arquivo não é AGUARDANDO APROVAÇÃO.");

  const quem = `Fabio (${d.email}), pelo painel /admin/marketing`;
  const quando = agoraBR();

  if (d.acao === "aprovar") {
    const todas = opcoesPlataforma(c.plataforma);
    const escolhidas = [...new Set(d.plataformas)];
    const invalidas = escolhidas.filter((p) => !todas.includes(p));
    if (invalidas.length)
      throw new Error(`Plataforma que não está no conteúdo: ${invalidas.join(", ")}`);
    if (!escolhidas.length) throw new Error("Marque ao menos uma plataforma.");
    const ordenadas = todas.filter((p) => escolhidas.includes(p));
    const novo = aplicarAprovacao(texto, {
      quem,
      quando,
      plataformas: ordenadas,
      todas,
      anuncioPago: c.anuncioPago,
    });
    await mover(nome, novo, "aprovados");
    await registrar([
      quando,
      d.id,
      "APROVADO",
      ordenadas.join(", "),
      c.anuncioPago ? "anúncio pago: orçamento não autorizado" : "",
      d.email,
    ]);
    return { status: "APROVADO" };
  }

  const motivo = textoUmaLinha(d.motivo);
  const novo = aplicarRecusa(texto, { quem, quando, motivo });
  await mover(nome, novo, "conteudos");
  await registrar([quando, d.id, "RECUSADO", "", motivo, d.email]);
  return { status: "RASCUNHO" };
}
