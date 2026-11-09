// Testes da leitura dos arquivos de marketing (pasta marketing/) usada em
// /admin/marketing. Lê os arquivos reais do repositório. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  extrairCenas,
  extrairListaApos,
  aplicarAprovacao,
  aplicarRecusa,
  extrairSlides,
  lerConteudoMarketing,
  opcoesPlataforma,
  textoUmaLinha,
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
  const c = porId("IG-05");
  const passo = proximoPasso({ ...c, status: "AGUARDANDO APROVAÇÃO" });
  assert.match(passo, /Aprovo o IG-05/);
  assert.match(passo, /Sua decisão/);
});

test("'dados ilustrativos' não vira título da arte", () => {
  const c = porId("GO-01");
  assert.equal(tipoPrevia(c), "perfil-google");
  assert.doesNotMatch(textosEntreAspas(c.secoes[SECAO_ARTE] ?? "").join("|"), /ilustrativ/);
});

// Arquivo em aprovacao/ com o bloco de aprovação vazio.
const aguardando = () =>
  readFileSync(join(RAIZ, "conteudos", "_modelo.md"), "utf8")
    .replace("- **ID:** XX-00", "- **ID:** XX-01")
    .replace(
      "- **Plataforma:** (ex.: Instagram feed + Facebook página)",
      "- **Plataforma:** Instagram (feed) + Facebook (página) + WhatsApp Status (mesma arte)",
    )
    .replace("- **Status:** RASCUNHO", "- **Status:** AGUARDANDO APROVAÇÃO");

test("opções de plataforma vêm do campo Plataforma", () => {
  assert.deepEqual(
    opcoesPlataforma("Instagram (feed) + Facebook (página) + WhatsApp Status (mesma arte)"),
    ["Instagram (feed)", "Facebook (página)", "WhatsApp Status (mesma arte)"],
  );
  assert.deepEqual(opcoesPlataforma("TikTok"), ["TikTok"]);
});

test("aprovar: status, quem, data, só as plataformas marcadas e as de fora anotadas", () => {
  const t = aplicarAprovacao(aguardando(), {
    quem: "Fabio",
    quando: "10/11/2026 14:00",
    plataformas: ["Instagram (feed)", "Facebook (página)"],
    todas: opcoesPlataforma("Instagram (feed) + Facebook (página) + WhatsApp Status (mesma arte)"),
    anuncioPago: false,
  });
  const c = lerConteudoMarketing(t, "aprovados", "XX-01-x.md");
  assert.equal(c.status, "APROVADO");
  assert.equal(c.aprovacao.aprovadoPor, "Fabio");
  assert.equal(c.aprovacao.data, "10/11/2026 14:00");
  assert.equal(c.aprovacao.plataformas, "Instagram (feed), Facebook (página)");
  assert.match(c.aprovacao.observacoes, /NÃO autorizadas: WhatsApp Status/);
  assert.match(c.aprovacao.observacoes, /não autoriza publicar/);
});

test("aprovar sem plataforma ou fora de 'aguardando' é recusado", () => {
  const base = { quem: "F", quando: "x", todas: ["TikTok"], anuncioPago: false };
  assert.throws(() => aplicarAprovacao(aguardando(), { ...base, plataformas: [] }), /ao menos uma/);
  const aprovado = aguardando().replace("AGUARDANDO APROVAÇÃO", "APROVADO");
  assert.throws(
    () => aplicarAprovacao(aprovado, { ...base, plataformas: ["TikTok"] }),
    /não está com status/,
  );
});

test("anúncio pago aprovado anota que o orçamento não foi autorizado", () => {
  const t = aplicarAprovacao(aguardando(), {
    quem: "F",
    quando: "x",
    plataformas: ["TikTok"],
    todas: ["TikTok"],
    anuncioPago: true,
  });
  assert.match(t, /orçamento NÃO autorizado/);
});

test("recusar: volta a rascunho, limpa a aprovação e guarda o motivo", () => {
  const t = aplicarRecusa(aguardando(), {
    quem: "Fabio",
    quando: "10/11/2026",
    motivo: "trocar o gancho",
  });
  const c = lerConteudoMarketing(t, "conteudos", "XX-01-x.md");
  assert.equal(c.status, "RASCUNHO");
  assert.equal(c.aprovacao.aprovadoPor, "");
  assert.match(
    c.aprovacao.observacoes,
    /RECUSADO em 10\/11\/2026 por Fabio\. Motivo: trocar o gancho/,
  );
});

test("texto de uma linha remove quebras e barras da tabela", () => {
  assert.equal(textoUmaLinha("a | b\nc"), "a b c");
});
