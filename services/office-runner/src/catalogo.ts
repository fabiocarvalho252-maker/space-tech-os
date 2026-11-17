// Catálogo real de agentes e skills do ECC, lido dos arquivos na VPS. O setor
// vem do mesmo mapa do painel (setores.ts do app).
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export type ItemCatalogo = {
  id: string;
  nome: string;
  descricao: string;
  setor: string;
  tipo: "agente" | "skill";
};

const MAPA_SETOR: Record<string, string> = {
  planner: "planejamento",
  architect: "planejamento",
  "build-error-resolver": "engenharia",
  "refactor-cleaner": "engenharia",
  "code-reviewer": "qualidade",
  "tdd-guide": "qualidade",
  "e2e-runner": "qualidade",
  "security-reviewer": "seguranca",
  "doc-updater": "docs",
};

export function setorDoAgente(id: string): string {
  return MAPA_SETOR[id] ?? "geral";
}

// Lê o front matter simples (name/description) de um .md de agente.
export function lerFrontMatter(conteudo: string): { nome?: string; descricao?: string } {
  const bloco = conteudo.match(/^---\n([\s\S]*?)\n---/);
  if (!bloco?.[1]) return {};
  const campos: Record<string, string> = {};
  for (const linha of bloco[1].split("\n")) {
    const m = linha.match(/^([a-z_-]+):\s*(.*)$/i);
    if (m?.[1]) campos[m[1]] = (m[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return { ...(campos["name"] ? { nome: campos["name"] } : {}), ...(campos["description"] ? { descricao: campos["description"] } : {}) };
}

export async function carregarCatalogo(claudeHome: string): Promise<ItemCatalogo[]> {
  const itens: ItemCatalogo[] = [];
  const pastaAgentes = join(claudeHome, "agents");
  for (const arquivo of await listarSeExistir(pastaAgentes)) {
    if (!arquivo.endsWith(".md")) continue;
    const conteudo = await readFile(join(pastaAgentes, arquivo), "utf8");
    const id = arquivo.replace(/\.md$/, "");
    const { descricao } = lerFrontMatter(conteudo);
    itens.push({ id, nome: id, descricao: descricao ?? "", setor: setorDoAgente(id), tipo: "agente" });
  }
  const pastaSkills = join(claudeHome, "skills");
  for (const pasta of await listarSeExistir(pastaSkills)) {
    const caminho = join(pastaSkills, pasta);
    if (!(await stat(caminho)).isDirectory()) continue;
    itens.push({ id: pasta, nome: pasta, descricao: "", setor: "geral", tipo: "skill" });
  }
  return itens.sort((a, b) => a.id.localeCompare(b.id));
}

async function listarSeExistir(pasta: string): Promise<string[]> {
  try {
    return await readdir(pasta);
  } catch {
    return [];
  }
}
