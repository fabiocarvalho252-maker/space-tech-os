// Publica UM conteúdo aprovado em UMA plataforma (Instagram ou Facebook), por
// ordem do administrador (botão "Publicar" + confirmação). Confere de novo:
// status APROVADO/PUBLICADO, plataforma autorizada na aprovação, ainda não
// publicado nela e arquivo igual ao que o admin estava vendo. Depois registra
// no arquivo (vai para publicados/) e em registro-decisoes.md.
import { appendFile, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  aplicarPublicacao,
  jaPublicadoEm,
  lerConteudoMarketing,
  plataformasPublicaveis,
  textoParaPublicar,
  textoUmaLinha,
  type PastaMarketing,
  type PlataformaMeta,
} from "./conteudo";
import { agoraBR } from "./decisao.server";
import { assinarMidias } from "./midia.server";
import { lerContas, origemSite, publicarFacebook, publicarInstagram } from "./meta.server";

const emAndamento = new Set<string>();
const raiz = () => join(process.cwd(), "marketing");

async function acharArquivo(id: string): Promise<{ pasta: PastaMarketing; nome: string }> {
  for (const pasta of ["aprovados", "publicados"] as const) {
    const nomes = await readdir(join(raiz(), pasta)).catch(() => [] as string[]);
    const nome = nomes.find((n) => n.startsWith(`${id}-`) && n.endsWith(".md"));
    if (nome) return { pasta, nome };
  }
  throw new Error(`O ${id} não está aprovado (atualize a página).`);
}

export async function publicarConteudo(d: {
  id: string;
  plataforma: PlataformaMeta;
  versao: string;
  email: string;
}): Promise<{ link: string }> {
  const chave = `${d.id}|${d.plataforma}`;
  if (emAndamento.has(chave)) throw new Error("Esta publicação já está em andamento.");
  emAndamento.add(chave);
  try {
    const { pasta, nome } = await acharArquivo(d.id);
    const caminho = join(raiz(), pasta, nome);
    const info = await stat(caminho);
    if (info.mtime.toISOString() !== d.versao)
      throw new Error(
        "O conteúdo foi alterado desde que você abriu. Atualize a página e confira de novo.",
      );
    const texto = await readFile(caminho, "utf8");
    const c = lerConteudoMarketing(texto, pasta, nome);
    if (!plataformasPublicaveis(c).includes(d.plataforma))
      throw new Error("Esta plataforma não foi autorizada na aprovação deste conteúdo.");
    if (jaPublicadoEm(texto, d.plataforma))
      throw new Error("Este conteúdo já foi publicado nesta plataforma.");

    const contas = await lerContas();
    const pagina = contas?.paginas.find((p) => p.id === contas.paginaId);
    if (!pagina) throw new Error("Conecte o Instagram/Facebook na aba Contas e escolha a Página.");

    const m = await assinarMidias(d.id, 3 * 3600);
    const abs = (u: string) => `${origemSite()}${u}`;
    const midia = { imagens: (m.slides ?? []).map(abs), video: m.video ? abs(m.video.url) : null };
    if (!midia.video && !midia.imagens.length)
      throw new Error("Gere a imagem ou o vídeo deste conteúdo antes de publicar.");

    const legenda = textoParaPublicar(c, d.plataforma);
    const r =
      d.plataforma === "instagram"
        ? await publicarInstagram(pagina, legenda, midia)
        : await publicarFacebook(pagina, legenda, midia);

    const quando = agoraBR();
    const novo = aplicarPublicacao(texto, { plataforma: d.plataforma, link: r.link, quando });
    if (pasta === "aprovados") {
      const alvo = join(raiz(), "publicados", nome);
      await writeFile(`${alvo}.tmp-${process.pid}`, novo, "utf8");
      await rename(`${alvo}.tmp-${process.pid}`, alvo);
      await unlink(caminho);
    } else {
      await writeFile(caminho, novo, "utf8");
    }
    const plat = d.plataforma === "instagram" ? "Instagram" : "Facebook";
    await appendFile(
      join(raiz(), "registro-decisoes.md"),
      `| ${quando} | ${d.id} | PUBLICADO | ${plat} | ${textoUmaLinha(r.link)} | ${textoUmaLinha(d.email)} |\n`,
      "utf8",
    );
    return { link: r.link };
  } finally {
    emAndamento.delete(chave);
  }
}
