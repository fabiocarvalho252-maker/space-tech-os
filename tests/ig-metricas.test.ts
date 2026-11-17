// Testes das contas do painel de métricas do Instagram (funções puras, sem rede
// nem banco). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  engajamentoMedio,
  rankingPosts,
  variacaoSeguidores,
  type PostMetricas,
  type PontoSeguidores,
} from "../src/lib/marketing/ig-metricas.calc.ts";

const post = (over: Partial<PostMetricas>): PostMetricas => ({
  id: "p",
  tipo: "IMAGE",
  data: "2026-11-01",
  legenda: "",
  miniatura: null,
  permalink: null,
  alcance: 0,
  curtidas: 0,
  comentarios: 0,
  salvamentos: 0,
  compartilhamentos: 0,
  visualizacoes: 0,
  ...over,
});

const serie = (dias: number, inicio: number, passo: number): PontoSeguidores[] =>
  Array.from({ length: dias }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 1 + i));
    return { data: d.toISOString().slice(0, 10), seguidores: inicio + i * passo };
  });

test("variação de 7 dias compara o último dia com o de 7 dias antes", () => {
  const s = serie(30, 100, 2); // 100, 102, ... até 158
  const v = variacaoSeguidores(s, 7);
  assert.equal(v.suficiente, true);
  assert.equal(v.atual, 158);
  assert.equal(v.anterior, 144);
  assert.equal(v.delta, 14);
  assert.equal(v.percentual, Math.round((14 / 144) * 1000) / 10);
});

test("variação marca histórico insuficiente quando a série é curta demais", () => {
  const v = variacaoSeguidores(serie(5, 100, 1), 30);
  assert.equal(v.suficiente, false);
  assert.equal(v.delta, null);
  assert.equal(v.percentual, null);
});

test("variação com série vazia não quebra", () => {
  const v = variacaoSeguidores([], 7);
  assert.equal(v.suficiente, false);
  assert.equal(v.atual, null);
});

test("variação ignora pontos fora da janela e não depende da ordem de entrada", () => {
  const s = serie(20, 0, 1).reverse();
  const v = variacaoSeguidores(s, 7);
  assert.equal(v.atual, 19);
  assert.equal(v.delta, 7);
});

test("engajamento médio é a média por post de (curtidas+comentários+salvos+compartilhamentos) / alcance", () => {
  const posts = [
    post({ id: "a", alcance: 100, curtidas: 10, comentarios: 0, salvamentos: 5, compartilhamentos: 5 }),
    post({ id: "b", alcance: 200, curtidas: 20, comentarios: 10, salvamentos: 0, compartilhamentos: 0 }),
  ];
  // a: 20/100 = 20%, b: 30/200 = 15% → média 17.5%
  assert.equal(engajamentoMedio(posts), 17.5);
});

test("engajamento médio ignora posts sem alcance e retorna null sem dados", () => {
  assert.equal(engajamentoMedio([post({ alcance: 0, curtidas: 9 })]), null);
  assert.equal(engajamentoMedio([]), null);
});

test("ranking por alcance ordena do maior para o menor e respeita o limite", () => {
  const posts = [
    post({ id: "a", alcance: 10 }),
    post({ id: "b", alcance: 300 }),
    post({ id: "c", alcance: 50 }),
  ];
  const r = rankingPosts(posts, "alcance", 2);
  assert.deepEqual(
    r.map((p) => p.id),
    ["b", "c"],
  );
});

test("ranking por salvamentos desempata pelo alcance", () => {
  const posts = [
    post({ id: "a", salvamentos: 5, alcance: 100 }),
    post({ id: "b", salvamentos: 5, alcance: 400 }),
    post({ id: "c", salvamentos: 9, alcance: 1 }),
  ];
  assert.deepEqual(
    rankingPosts(posts, "salvamentos", 10).map((p) => p.id),
    ["c", "b", "a"],
  );
});

test("ranking não altera o array original", () => {
  const posts = [post({ id: "a", alcance: 1 }), post({ id: "b", alcance: 2 })];
  const copia = posts.map((p) => p.id);
  rankingPosts(posts, "alcance", 10);
  assert.deepEqual(
    posts.map((p) => p.id),
    copia,
  );
});

import { serieSeguidores } from "../src/lib/marketing/ig-metricas.calc.ts";
import { normalizarMidia } from "../src/lib/marketing/ig-metricas.normalizar.ts";

test("série preenche dias sem coleta com o último valor conhecido e corta na janela", () => {
  const pontos = [
    { data: "2026-11-01", seguidores: 100 },
    { data: "2026-11-04", seguidores: 110 },
  ];
  const s = serieSeguidores(pontos, 5, "2026-11-05");
  assert.deepEqual(
    s.map((p) => [p.data, p.seguidores]),
    [
      ["2026-11-01", 100],
      ["2026-11-02", 100],
      ["2026-11-03", 100],
      ["2026-11-04", 110],
      ["2026-11-05", 110],
    ],
  );
});

test("série antes da primeira coleta fica de fora, não recebe valor inventado", () => {
  const s = serieSeguidores([{ data: "2026-11-03", seguidores: 50 }], 5, "2026-11-05");
  assert.deepEqual(
    s.map((p) => p.data),
    ["2026-11-03", "2026-11-04", "2026-11-05"],
  );
});

test("normaliza post de imagem com métricas completas", () => {
  const p = normalizarMidia({
    id: "17900",
    media_type: "IMAGE",
    timestamp: "2026-11-10T14:00:00+0000",
    caption: "Película nova",
    media_url: "https://cdn/x.jpg",
    permalink: "https://instagram.com/p/x",
    like_count: 40,
    comments_count: 3,
    insights: { data: [
      { name: "reach", values: [{ value: 900 }] },
      { name: "saved", values: [{ value: 12 }] },
      { name: "shares", values: [{ value: 4 }] },
      { name: "views", values: [{ value: 1100 }] },
    ] },
  });
  assert.equal(p.id, "17900");
  assert.equal(p.tipo, "IMAGE");
  assert.equal(p.data, "2026-11-10");
  assert.equal(p.alcance, 900);
  assert.equal(p.curtidas, 40);
  assert.equal(p.comentarios, 3);
  assert.equal(p.salvamentos, 12);
  assert.equal(p.compartilhamentos, 4);
  assert.equal(p.visualizacoes, 1100);
});

test("métrica ausente vira 0 em contagens de engajamento mas null em alcance e visualizações", () => {
  const p = normalizarMidia({ id: "1", media_type: "VIDEO", timestamp: "2026-11-10T00:00:00+0000", insights: { data: [] } });
  assert.equal(p.alcance, null);
  assert.equal(p.visualizacoes, null);
  assert.equal(p.compartilhamentos, null);
  assert.equal(p.curtidas, 0);
});

test("legenda longa é truncada e sem legenda vira texto vazio", () => {
  const longa = "a".repeat(400);
  assert.equal(normalizarMidia({ id: "1", media_type: "IMAGE", timestamp: "2026-11-10T00:00:00+0000", caption: longa }).legenda.length, 160);
  assert.equal(normalizarMidia({ id: "2", media_type: "IMAGE", timestamp: "2026-11-10T00:00:00+0000" }).legenda, "");
});

test("tipo REELS da API vem como VIDEO e CAROUSEL_ALBUM vira CARROSSEL", () => {
  assert.equal(normalizarMidia({ id: "1", media_type: "VIDEO", media_product_type: "REELS", timestamp: "2026-11-10T00:00:00+0000" }).tipo, "REELS");
  assert.equal(normalizarMidia({ id: "2", media_type: "CAROUSEL_ALBUM", timestamp: "2026-11-10T00:00:00+0000" }).tipo, "CARROSSEL");
});

import {
  diaBrasil,
  filtrarPorPeriodo,
  somarMetrica,
} from "../src/lib/marketing/ig-metricas.calc.ts";

test("soma ignora null e devolve null quando não há nenhum valor", () => {
  const posts = [
    post({ id: "a", salvamentos: 4 }),
    post({ id: "b", salvamentos: null }),
    post({ id: "c", salvamentos: 6 }),
  ];
  assert.equal(somarMetrica(posts, "salvamentos"), 10);
  assert.equal(somarMetrica([post({ id: "d", salvamentos: null })], "salvamentos"), null);
  assert.equal(somarMetrica([], "salvamentos"), null);
});

test("filtra posts pela janela de dias até hoje, inclusive o primeiro dia", () => {
  const posts = [
    post({ id: "antigo", data: "2026-10-01" }),
    post({ id: "limite", data: "2026-11-05" }),
    post({ id: "hoje", data: "2026-11-11" }),
  ];
  // janela de 7 dias até 11/11 cobre 05/11 a 11/11
  assert.deepEqual(
    filtrarPorPeriodo(posts, 7, "2026-11-11").map((p) => p.id),
    ["limite", "hoje"],
  );
});

test("diaBrasil usa o fuso de Brasília, não UTC", () => {
  // 02:30 UTC de 12/11 ainda é 11/11 às 23:30 em Brasília (UTC-3)
  assert.equal(diaBrasil(new Date("2026-11-12T02:30:00Z")), "2026-11-11");
  assert.equal(diaBrasil(new Date("2026-11-12T15:00:00Z")), "2026-11-12");
});

import { formatarValor, linkSeguro } from "../src/lib/marketing/ig-metricas.calc.ts";

test("link só vira href quando é https válido", () => {
  assert.equal(linkSeguro("https://www.instagram.com/p/abc/"), "https://www.instagram.com/p/abc/");
  assert.equal(linkSeguro("javascript:alert(1)"), undefined);
  assert.equal(linkSeguro("http://insecure.example"), undefined);
  assert.equal(linkSeguro("não é url"), undefined);
  assert.equal(linkSeguro(null), undefined);
});

test("valor nulo aparece como n/d e número usa separador brasileiro", () => {
  assert.equal(formatarValor(null), "n/d");
  assert.equal(formatarValor(12345), "12.345");
});

test("post publicado depois das 21h de Brasília cai no dia de Brasília, não no dia UTC", () => {
  // 01:30 UTC de 12/11 = 22:30 de 11/11 em Brasília
  const p = normalizarMidia({ id: "t", media_type: "IMAGE", timestamp: "2026-11-12T01:30:00+0000" });
  assert.equal(p.data, "2026-11-11");
});

test("miniatura só é aceita em https; URL inválida vira null", () => {
  const ok = normalizarMidia({ id: "1", media_type: "IMAGE", timestamp: "2026-11-10T00:00:00+0000", thumbnail_url: "https://scontent.cdninstagram.com/x.jpg" });
  const ruim = normalizarMidia({ id: "2", media_type: "IMAGE", timestamp: "2026-11-10T00:00:00+0000", media_url: "javascript:alert(1)" });
  assert.equal(ok.miniatura, "https://scontent.cdninstagram.com/x.jpg");
  assert.equal(ruim.miniatura, null);
});

test("engajamento médio deixa de fora posts sem salvos ou compartilhamentos (não subestima como 0)", () => {
  const posts = [
    post({ id: "a", alcance: 100, curtidas: 10, salvamentos: null, compartilhamentos: null }),
    post({ id: "b", alcance: 100, curtidas: 10, salvamentos: 5, compartilhamentos: 5 }),
  ];
  // só o post "b" conta: (10+0+5+5)/100 = 20%
  assert.equal(engajamentoMedio(posts), 20);
});

import { resumoParaLeitor } from "../src/lib/marketing/ig-metricas.calc.ts";

test("resumo para leitor de tela diz o ganho e o total no período", () => {
  const texto = resumoParaLeitor([
    { data: "2026-11-01", seguidores: 100 },
    { data: "2026-11-10", seguidores: 130 },
  ]);
  assert.equal(texto, "De 01/11 a 10/11 a conta ganhou 30 seguidores, chegando a 130.");
  assert.equal(resumoParaLeitor([]), "Sem dados de seguidores.");
});

import { seguidoresValidos } from "../src/lib/marketing/ig-metricas.calc.ts";

test("valores zero ou negativos da série de seguidores são tratados como sem dado", () => {
  const valores = [
    { value: 0, end_time: "2026-11-15T07:00:00+0000" },
    { value: 625, end_time: "2026-11-17T07:00:00+0000" },
    { value: -3, end_time: "2026-11-18T07:00:00+0000" },
    { value: 610, end_time: "2026-11-16T07:00:00+0000" },
  ];
  assert.deepEqual(
    seguidoresValidos(valores).map((v) => v.value),
    [625, 610],
  );
});
