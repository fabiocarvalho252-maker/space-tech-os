// Testes puros do pathfinding do Escritório IA: A*, bloqueios, limite de
// iterações e suavização. Não importam three nem React.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encontrarCaminho,
  suavizarCaminho,
  type Celula,
  type Grade,
} from "../src/features/escritorio/scene3d/pathfinding.ts";

function criarGrade(largura: number, altura: number, bloqueadas: Celula[] = []): Grade {
  return {
    largura,
    altura,
    bloqueada: (x, z) => bloqueadas.some((c) => c.x === x && c.z === z),
  };
}

function vizinhos(zona: Celula[]): Celula[] {
  const saida: Celula[] = [];
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      if (x === 0 && z === 0) continue;
      saida.push(...zona.map((c) => ({ x: c.x + x, z: c.z + z })));
    }
  }
  return saida;
}

function caminhoEhValido(grade: Grade, caminho: Celula[]): boolean {
  for (let i = 0; i < caminho.length - 1; i++) {
    const a = caminho[i];
    const b = caminho[i + 1];
    if (!a || !b) return false;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 1) return false;
    if (grade.bloqueada(b.x, b.z)) return false;
    if (dx !== 0 && dz !== 0) {
      if (grade.bloqueada(a.x + dx, a.z) || grade.bloqueada(a.x, a.z + dz)) return false;
    }
  }
  return caminho.every((c) => !grade.bloqueada(c.x, c.z));
}

test("caminho em grade livre liga origem e destino com passos válidos", () => {
  // Arrange
  const grade = criarGrade(5, 5);
  const origem = { x: 0, z: 0 };
  const destino = { x: 3, z: 3 };

  // Act
  const caminho = encontrarCaminho(grade, origem, destino);

  // Assert
  assert.ok(caminho);
  assert.deepEqual(caminho[0], origem);
  assert.deepEqual(caminho[caminho.length - 1], destino);
  assert.equal(caminho.length, 4);
  assert.ok(caminhoEhValido(grade, caminho));
});

test("contorna parede que bloqueia a linha reta", () => {
  // Arrange: parede em x=2 para z=0..3; única passagem em z=4
  const parede: Celula[] = [0, 1, 2, 3].map((z) => ({ x: 2, z }));
  const grade = criarGrade(5, 5, parede);

  // Act
  const caminho = encontrarCaminho(grade, { x: 0, z: 0 }, { x: 4, z: 0 });

  // Assert
  assert.ok(caminho, "deveria existir caminho pela abertura");
  assert.ok(caminhoEhValido(grade, caminho));
  assert.ok(caminho.some((c) => c.x === 2 && c.z === 4));
});

test("retorna null quando o destino está isolado", () => {
  // Arrange: todas as 8 vizinhas de (2,2) bloqueadas
  const grade = criarGrade(5, 5, vizinhos([{ x: 2, z: 2 }]));

  // Act
  const caminho = encontrarCaminho(grade, { x: 0, z: 0 }, { x: 2, z: 2 });

  // Assert
  assert.equal(caminho, null);
});

test("origem igual ao destino retorna apenas essa célula", () => {
  // Arrange
  const grade = criarGrade(3, 3);

  // Act
  const caminho = encontrarCaminho(grade, { x: 1, z: 1 }, { x: 1, z: 1 });

  // Assert
  assert.deepEqual(caminho, [{ x: 1, z: 1 }]);
});

test("limite de iterações impede travamento em grade grande sem rota", () => {
  // Arrange: grade 150x150 com destino cercado (rota impossível)
  const grade = criarGrade(150, 150, vizinhos([{ x: 75, z: 75 }]));

  // Act
  const caminho = encontrarCaminho(grade, { x: 0, z: 0 }, { x: 75, z: 75 });

  // Assert
  assert.equal(caminho, null);
});

test("suavização remove pontos intermediários em linha reta", () => {
  // Arrange
  const grade = criarGrade(5, 5);
  const caminho: Celula[] = [0, 1, 2, 3, 4].map((x) => ({ x, z: 0 }));

  // Act
  const suavizado = suavizarCaminho(caminho, grade);

  // Assert
  assert.deepEqual(suavizado, [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
  ]);
});

test("suavização mantém o desvio que contorna obstáculo central", () => {
  // Arrange: centro (1,1) bloqueado impede a diagonal (0,0)-(2,2)
  const grade = criarGrade(3, 3, [{ x: 1, z: 1 }]);
  const caminho: Celula[] = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 1 },
    { x: 2, z: 2 },
  ];

  // Act
  const suavizado = suavizarCaminho(caminho, grade);

  // Assert
  assert.deepEqual(suavizado, [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
    { x: 2, z: 2 },
  ]);
});

test("diagonal é bloqueada quando uma esquina está ocupada", () => {
  // Arrange: (1,0) bloqueada; a diagonal (0,0)->(1,1) cortaria a esquina
  const grade = criarGrade(3, 3, [{ x: 1, z: 0 }]);

  // Act
  const caminho = encontrarCaminho(grade, { x: 0, z: 0 }, { x: 1, z: 1 });

  // Assert
  assert.deepEqual(caminho, [
    { x: 0, z: 0 },
    { x: 0, z: 1 },
    { x: 1, z: 1 },
  ]);
});
