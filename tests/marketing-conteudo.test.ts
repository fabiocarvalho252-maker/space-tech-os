// Testes da leitura dos arquivos de marketing (pasta marketing/) usada em
// /admin/marketing. Lê os arquivos reais do repositório. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  extrairCenas,
  extrairListaApos,
  extrairSlides,
  lerConteudoMarketing,
  PASTAS_MARKETING,
  proximoPasso,
  SECAO_ARTE,
  SECAO_TEXTO,
  textosEntreAspas,
  tipoPrevia,
  type ConteudoMarketing,
  type PastaMarketing,
} from "../src/lib/marketing/conteudo.ts";

const RAIZ = join(import.meta.dirname, "..", "marketing");

function todos(): ConteudoMarketing[] {
  const lista: ConteudoMarketing[] = [];
  for (const pasta of Object.keys(PASTAS_MARKETING) as PastaMarketing[]) {
    for (const nome of readdirSync(join(RAIZ, pasta))) {
      if (!nome.endsWith(".md") || nome === "README.md" || nome.startsWith("_")) continue;
      lista.push(lerConteudoMarketing(readFileSync(join(RAIZ, pasta, nome), "utf8"), pasta, nome));
    }
  }
  return lista;
}

const porId = (id: string) => {
  const c = todos().find((x) => x.id === id);
  assert.ok(c, `conteúdo ${id} não encontrado`);
  return c;
};

test("todo arquivo de conteúdo vira um conteúdo completo, com status da pasta", () => {
  const lista = todos();
  assert.ok(lista.length >= 18);
  for (const c of lista) {
    assert.equal(c.status, PASTAS_MARKETING[c.pasta], `${c.arquivo}: status x pasta`);
    assert.ok(c.titulo && !c.titulo.startsWith(c.id), `${c.arquivo}: título sem o ID`);
    assert.ok(c.plataforma && c.formato && c.objetivo, `${c.arquivo}: campos`);
    assert.ok((c.secoes[SECAO_TEXTO] ?? "").length > 20, `${c.arquivo}: texto pronto`);
    for (const l of c.links) assert.match(l.url, /^https:\/\/srmpretech\.online\//);
  }
});

test("aprovados trazem quem aprovou e as plataformas", () => {
  const c = porId("IG-01");
  assert.equal(c.status, "APROVADO");
  assert.match(c.aprovacao.aprovadoPor, /Fabio/);
  assert.match(c.aprovacao.plataformas, /Instagram/);
  assert.doesNotMatch(c.aprovacao.plataformas, /WhatsApp/);
  assert.match(proximoPasso(c), /aprovar não publica/);
});

test("carrossel vira slides com o texto entre aspas como título", () => {
  const c = porId("IG-01");
  assert.equal(tipoPrevia(c), "carrossel");
  const slides = extrairSlides(c.secoes[SECAO_ARTE] ?? "");
  assert.equal(slides.length, 5);
  assert.equal(slides[0]!.titulo, "Meu celular já ficou pronto?");
});

test("roteiro de vídeo vira cenas com tempo e texto na tela", () => {
  const c = porId("IG-02");
  assert.equal(tipoPrevia(c), "video");
  const cenas = extrairCenas(c.secoes[SECAO_ARTE] ?? "");
  assert.ok(cenas.length >= 5);
  assert.match(cenas[0]!.tempo, /0–3 s/);
  assert.match(cenas[0]!.textoNaTela, /Original ou paralela/);
});

test("anúncio de pesquisa: títulos e descrições; marcado como pago", () => {
  const c = porId("GO-02");
  assert.equal(tipoPrevia(c), "anuncio-pesquisa");
  assert.ok(c.anuncioPago);
  const texto = c.secoes[SECAO_TEXTO] ?? "";
  assert.equal(extrairListaApos(texto, /^\*\*T[íi]tulos/).length, 8);
  assert.equal(extrairListaApos(texto, /^\*\*Descri[çc][õo]es/).length, 4);
  assert.match(proximoPasso(c), /orçamento/);
});

test("tipos de prévia: WhatsApp, Perfil do Google e imagem única", () => {
  assert.equal(tipoPrevia(porId("WA-01")), "whatsapp");
  assert.equal(tipoPrevia(porId("GO-01")), "perfil-google");
  assert.equal(tipoPrevia(porId("IG-04")), "imagem");
});

test("aguardando aprovação explica como aprovar", () => {
  assert.match(proximoPasso(porId("IG-04")), /Aprovo o IG-04/);
});

test("'dados ilustrativos' não vira título da arte", () => {
  const c = porId("GO-01");
  assert.equal(tipoPrevia(c), "perfil-google");
  assert.doesNotMatch(textosEntreAspas(c.secoes[SECAO_ARTE] ?? "").join("|"), /ilustrativ/);
});
