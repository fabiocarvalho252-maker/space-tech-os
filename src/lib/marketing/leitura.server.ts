// Lê a pasta marketing/ do projeto direto do disco, a cada pedido: uma
// aprovação registrada nos arquivos aparece em /admin/marketing sem rebuild
// nem deploy. Só lê nomes fixos (documentos) e arquivos .md das quatro pastas
// do fluxo — nada vindo do navegador entra no caminho.
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  lerConteudoMarketing,
  PASTAS_MARKETING,
  type ConteudoMarketing,
  type PastaMarketing,
} from "./conteudo";
import { assinarMidias } from "./midia.server";

export const DOCUMENTOS_MARKETING = [
  { chave: "estrategia", arquivo: "estrategia.md", titulo: "Estratégia" },
  { chave: "calendario", arquivo: "calendario-30-dias.md", titulo: "Calendário" },
  { chave: "fatos", arquivo: "fatos-verificados.md", titulo: "Fatos verificados" },
  { chave: "resultados", arquivo: "resultados.md", titulo: "Resultados" },
  { chave: "decisoes", arquivo: "registro-decisoes.md", titulo: "Decisões" },
  { chave: "como-funciona", arquivo: "README.md", titulo: "Como funciona" },
] as const;

export type DocumentoMarketing = {
  chave: (typeof DOCUMENTOS_MARKETING)[number]["chave"];
  titulo: string;
  markdown: string;
  atualizadoEm: string;
};

export type MarketingAdmin = {
  disponivel: boolean;
  documentos: DocumentoMarketing[];
  conteudos: ConteudoMarketing[];
};

const TAMANHO_MAX = 256 * 1024;

function pastaRaiz(): string {
  // O serviço (systemd) e o vite dev rodam com o diretório do projeto como cwd.
  return join(process.cwd(), "marketing");
}

async function lerArquivo(
  caminho: string,
): Promise<{ texto: string; atualizadoEm: string } | null> {
  try {
    const info = await stat(caminho);
    if (!info.isFile() || info.size > TAMANHO_MAX) return null;
    return { texto: await readFile(caminho, "utf8"), atualizadoEm: info.mtime.toISOString() };
  } catch {
    return null;
  }
}

export async function lerMarketing(): Promise<MarketingAdmin> {
  const raiz = pastaRaiz();
  const existe = await stat(raiz)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!existe) return { disponivel: false, documentos: [], conteudos: [] };

  const documentos: DocumentoMarketing[] = [];
  for (const d of DOCUMENTOS_MARKETING) {
    const lido = await lerArquivo(join(raiz, d.arquivo));
    if (lido)
      documentos.push({
        chave: d.chave,
        titulo: d.titulo,
        markdown: lido.texto,
        atualizadoEm: lido.atualizadoEm,
      });
  }

  const conteudos: ConteudoMarketing[] = [];
  for (const pasta of Object.keys(PASTAS_MARKETING) as PastaMarketing[]) {
    const nomes = await readdir(join(raiz, pasta)).catch(() => [] as string[]);
    for (const nome of nomes.sort()) {
      if (!/^[A-Za-z0-9][\w.-]*\.md$/.test(nome) || nome === "README.md") continue;
      const lido = await lerArquivo(join(raiz, pasta, nome));
      if (lido) {
        const c = lerConteudoMarketing(lido.texto, pasta, nome, lido.atualizadoEm);
        const midia = await assinarMidias(c.id);
        if (midia.video || midia.capa || midia.slides) c.midia = midia;
        conteudos.push(c);
      }
    }
  }
  conteudos.sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
  return { disponivel: true, documentos, conteudos };
}
