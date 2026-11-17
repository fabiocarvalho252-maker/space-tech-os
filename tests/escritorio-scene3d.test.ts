// Testes puros da cena 3D do Escritório IA: conversão de coordenadas e presets
// de qualidade. Não importam three nem React.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caixasDasParedes,
  chaoEmTresD,
  paraX,
  paraZ,
  pontoParaTresD,
  retanguloParaTresD,
  salasEmTresD,
} from "../src/features/escritorio/scene3d/layout3d.ts";
import {
  LIMITE_TELA_COMPACTA,
  PRESETS_QUALIDADE,
  quality,
} from "../src/features/escritorio/scene3d/quality.ts";

const PRECISAO = 1e-9;

function aproximado(obtido: number, esperado: number): void {
  assert.ok(Math.abs(obtido - esperado) < PRECISAO, `${obtido} != ${esperado}`);
}

test("centro da tela lógica vira a origem do plano 3D", () => {
  aproximado(paraX(480), 0);
  aproximado(paraZ(320), 0);
});

test("cantos da tela lógica viram ±4,8 em x e ±3,2 em z", () => {
  aproximado(paraX(0), -4.8);
  aproximado(paraX(960), 4.8);
  aproximado(paraZ(0), -3.2);
  aproximado(paraZ(640), 3.2);
});

test("ponto 2D converte para x e z com a escala de 100 px por unidade", () => {
  const ponto = pontoParaTresD({ x: 175, y: 130 });
  aproximado(ponto.x, -3.05);
  aproximado(ponto.z, -1.9);
});

test("retângulo da diretoria tem centro e tamanho convertidos", () => {
  const retangulo = retanguloParaTresD(30, 30, 290, 200);
  aproximado(retangulo.centroX, -3.05);
  aproximado(retangulo.centroZ, -1.9);
  aproximado(retangulo.largura, 2.9);
  aproximado(retangulo.profundidade, 2);
});

test("chão ocupa a tela inteira centrado na origem", () => {
  const chao = chaoEmTresD();
  aproximado(chao.centroX, 0);
  aproximado(chao.centroZ, 0);
  aproximado(chao.largura, 9.6);
  aproximado(chao.profundidade, 6.4);
});

test("cada setor vira sala com mesas convertidas e borda frontal", () => {
  const salas = salasEmTresD();
  assert.equal(salas.length, 6);
  const diretoria = salas[0];
  assert.ok(diretoria);
  assert.equal(diretoria.id, "diretoria");
  assert.equal(diretoria.mesas.length, 1);
  aproximado(diretoria.zFrontal, -0.9);
  const planejamento = salas[1];
  assert.equal(planejamento?.mesas.length, 2);
});

test("paredes de vidro somam quatro caixas em volta da sala", () => {
  const diretoria = salasEmTresD()[0];
  assert.ok(diretoria);
  const paredes = caixasDasParedes(diretoria, 1.1, 0.04);
  assert.equal(paredes.length, 4);
  const [fundo, frente, esquerda, direita] = paredes;
  assert.ok(fundo && frente && esquerda && direita);
  aproximado(fundo.posicao[2], diretoria.centroZ - diretoria.profundidade / 2);
  aproximado(frente.posicao[2], diretoria.centroZ + diretoria.profundidade / 2);
  aproximado(esquerda.posicao[0], diretoria.centroX - diretoria.largura / 2);
  aproximado(direita.posicao[0], diretoria.centroX + diretoria.largura / 2);
  aproximado(esquerda.escala[2], diretoria.profundidade);
});

test("presets de qualidade têm sombras só nas opções alta e média", () => {
  assert.equal(PRESETS_QUALIDADE.alta.sombras, true);
  assert.equal(PRESETS_QUALIDADE.media.sombras, true);
  assert.equal(PRESETS_QUALIDADE.baixa.sombras, false);
  assert.equal(PRESETS_QUALIDADE.alta.sombraMapSize, 2048);
});

test("preset escolhido é usado em tela larga", () => {
  assert.equal(quality("alta", 1280).nome, "alta");
  assert.equal(quality("media", 1280).nome, "media");
  assert.equal(quality("baixa", 1280).nome, "baixa");
});

test("tela estreita força o preset baixa mesmo se alta foi escolhida", () => {
  assert.equal(quality("alta", 767).nome, "baixa");
  assert.equal(quality("media", 500).sombras, false);
});

test("limite de 768 px é inclusivo para o preset escolhido", () => {
  assert.equal(LIMITE_TELA_COMPACTA, 768);
  assert.equal(quality("media", 768).nome, "media");
});

test("resolução máxima do pixel decresce de alta para baixa", () => {
  assert.ok(PRESETS_QUALIDADE.alta.dprMaximo > PRESETS_QUALIDADE.media.dprMaximo);
  assert.ok(PRESETS_QUALIDADE.media.dprMaximo > PRESETS_QUALIDADE.baixa.dprMaximo);
});
