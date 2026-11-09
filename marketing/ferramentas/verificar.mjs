#!/usr/bin/env node
// Conferência dos conteúdos de marketing (sem dependências).
//
//   node marketing/ferramentas/verificar.mjs
//
// Para cada conteúdo em conteudos/, aprovacao/, aprovados/ e publicados/
// (ignora README.md e arquivos que começam com "_"), confere:
//   - campos obrigatórios (ID, Plataforma, Objetivo, Status) e seções
//     (texto, chamada para ação, arte/roteiro, fatos, aprovação, publicação);
//   - o ID do arquivo bate com o ID do conteúdo e não se repete;
//   - o status é válido e compatível com a pasta;
//   - links do site usam https://srmpretech.online e têm utm_source e
//     utm_campaign;
//   - aprovados/ e publicados/ têm "Aprovado por", "Data da aprovação" e
//     "Plataformas autorizadas" preenchidos; publicados/ têm data e link do post;
//   - anúncio pago fica marcado como "exige autorização de orçamento";
//   - nenhuma afirmação proibida (ver fatos-verificados.md).
// Sai com código 1 se encontrar qualquer problema.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

export const STATUS_POR_PASTA = {
  conteudos: "RASCUNHO",
  aprovacao: "AGUARDANDO APROVAÇÃO",
  aprovados: "APROVADO",
  publicados: "PUBLICADO",
};

const SECOES = [
  "## Texto pronto para publicar",
  "## Chamada para ação",
  "## Ideia de arte ou roteiro",
  "## Fatos usados",
  "## Aprovação",
  "## Publicação",
];

// Preços que existem hoje (fatos-verificados.md). Qualquer outro "R$" é erro.
const PRECOS_PERMITIDOS = new Set(["40", "40,00", "456", "456,00"]);

const PROIBIDOS = [
  [/nota fiscal|nf-?e\b|nfc-?e\b/i, "Nota Fiscal (módulo retirado do sistema)"],
  [/play ?store|google play/i, "Play Store (app ainda não publicado lá)"],
  [/n[ºo°]\.? ?1\b|número 1|\blíder\b|o melhor sistema/i, "superlativo sem prova"],
  [/\bgarantid[oa]s?\b/i, "promessa de resultado ('garantido')"],
  [/\bmilhares de\b|\bcentenas de (lojas|clientes|assistências)/i, "número de clientes inventado"],
  [/aumente (seu|o|a) .*\d+ ?%|\d+ ?% (a mais|mais) de (lucro|faturamento|vendas)/i, "resultado inventado"],
  [/plano (profissional|premium|pro)\b/i, "plano que não existe"],
];

function campo(texto, nome) {
  const m = texto.match(new RegExp(`^- \\*\\*${nome}[^*]*:\\*\\*[ \\t]*(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

function linhaPreenchida(texto, rotulo) {
  const m = texto.match(new RegExp(`^- ${rotulo}:[ \\t]*(.*)$`, "m"));
  return Boolean(m && m[1].trim());
}

export function verificarConteudo(texto, pasta, arquivo) {
  const erros = [];
  const id = campo(texto, "ID");
  const status = campo(texto, "Status");

  for (const nome of ["ID", "Plataforma", "Objetivo", "Status"]) {
    if (!campo(texto, nome)) erros.push(`campo obrigatório ausente: ${nome}`);
  }
  for (const s of SECOES) if (!texto.includes(s)) erros.push(`seção ausente: "${s}"`);

  if (id && !basename(arquivo).startsWith(`${id}-`))
    erros.push(`o nome do arquivo deve começar com o ID (${id}-)`);

  const esperado = STATUS_POR_PASTA[pasta];
  if (status && !Object.values(STATUS_POR_PASTA).includes(status))
    erros.push(`status inválido: "${status}"`);
  else if (status && status !== esperado)
    erros.push(`status "${status}" não combina com a pasta ${pasta}/ (esperado "${esperado}")`);

  const links = texto.match(/https?:\/\/[^\s)>"'`]+/g) ?? [];
  for (const link of links) {
    let url;
    try {
      url = new URL(link);
    } catch {
      erros.push(`link inválido: ${link}`);
      continue;
    }
    if (!/srmpretech\.online$/.test(url.hostname)) continue;
    if (url.protocol !== "https:") erros.push(`link sem https: ${link}`);
    if (url.hostname !== "srmpretech.online") erros.push(`domínio inesperado: ${link}`);
    for (const p of ["utm_source", "utm_campaign"])
      if (!url.searchParams.get(p)) erros.push(`link sem ${p}: ${link}`);
  }

  for (const m of texto.matchAll(/R\$\s?([\d.,]+)/g)) {
    const valor = m[1].replace(/[.,]$/, "");
    if (!PRECOS_PERMITIDOS.has(valor)) erros.push(`preço não cadastrado: R$ ${valor}`);
  }

  for (const [re, motivo] of PROIBIDOS) {
    const achado = texto.match(re);
    if (achado) erros.push(`afirmação proibida (${motivo}): "${achado[0]}"`);
  }

  if (/an[úu]ncio pago/i.test(texto) && !/exige autoriza[çc][ãa]o de or[çc]amento/i.test(texto))
    erros.push('anúncio pago sem o aviso "exige autorização de orçamento"');

  if (pasta === "aprovados" || pasta === "publicados") {
    for (const r of ["Aprovado por", "Data da aprovação", "Plataformas autorizadas"])
      if (!linhaPreenchida(texto, r)) erros.push(`aprovação incompleta: "${r}" vazio`);
  }
  if (pasta === "publicados") {
    for (const r of ["Data e hora", "Link do post"])
      if (!linhaPreenchida(texto, r)) erros.push(`publicação incompleta: "${r}" vazio`);
  }
  return { id, erros };
}

function main() {
  let total = 0;
  let comErro = 0;
  const ids = new Map();
  for (const pasta of Object.keys(STATUS_POR_PASTA)) {
    const dir = join(RAIZ, pasta);
    if (!existsSync(dir)) continue;
    for (const arquivo of readdirSync(dir).sort()) {
      if (!arquivo.endsWith(".md") || arquivo === "README.md" || arquivo.startsWith("_")) continue;
      total++;
      const caminho = `${pasta}/${arquivo}`;
      const { id, erros } = verificarConteudo(readFileSync(join(dir, arquivo), "utf8"), pasta, arquivo);
      if (id) {
        if (ids.has(id)) erros.push(`ID repetido (também em ${ids.get(id)})`);
        else ids.set(id, caminho);
      }
      if (erros.length) {
        comErro++;
        console.log(`✗ ${caminho}`);
        for (const e of erros) console.log(`    - ${e}`);
      } else {
        console.log(`✓ ${caminho}`);
      }
    }
  }
  console.log(`\n${total} conteúdo(s) conferido(s), ${comErro} com problema.`);
  process.exitCode = comErro ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
