// Navegação dos agentes na cena 3D: o caminho contorna as mesas e chega ao destino.
import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoEntre, celulaDe, pontoDaCelula } from "../src/features/escritorio/scene3d/navegacao.ts";

test("célula e ponto se convertem de volta no centro da célula", () => {
  const celula = celulaDe({ x: 100, y: 50 });
  assert.deepEqual(celula, { x: 6, z: 3 });
  assert.deepEqual(pontoDaCelula(celula), { x: 104, y: 56 });
});

test("caminho entre dois pontos livres termina no destino", () => {
  const caminho = caminhoEntre({ x: 20, y: 20 }, { x: 60, y: 60 });
  assert.ok(caminho.length >= 1);
  assert.deepEqual(caminho.at(-1), { x: 60, y: 60 });
});

test("caminho que atravessa uma mesa passa ao lado dela", () => {
  // Mesa da Diretoria em (175, 130); a ocupação vai de x 135 a 215 e y 114 a 160.
  const caminho = caminhoEntre({ x: 175, y: 60 }, { x: 175, y: 200 });
  const dentroDaMesa = caminho.some((p) => p.x >= 137 && p.x <= 213 && p.y >= 116 && p.y <= 158);
  assert.equal(dentroDaMesa, false);
  assert.deepEqual(caminho.at(-1), { x: 175, y: 200 });
});
