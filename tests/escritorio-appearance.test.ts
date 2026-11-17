// Testes da aparência procedural dos personagens do Escritório IA.
// Lógica pura: não importa three nem React.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACESSORIOS,
  PALETA_ACESSORIOS,
  PALETA_CABELOS,
  PALETA_PELES,
  PALETA_ROUPAS,
  aparenciaDoAgente,
  hashNome,
} from "../src/features/escritorio/scene3d/characters/appearance.ts";

const NOMES_DE_AGENTES = [
  "planner",
  "tdd-guide",
  "code-reviewer",
  "security-reviewer",
  "build-error-resolver",
  "e2e-runner",
  "refactor-cleaner",
  "doc-updater",
  "architect",
  "marketing-agent",
];

test("hashNome devolve sempre o mesmo valor para o mesmo nome", () => {
  // Arrange
  const nome = "planner";

  // Act
  const primeiro = hashNome(nome);
  const segundo = hashNome(nome);

  // Assert
  assert.equal(primeiro, segundo);
});

test("hashNome devolve inteiro de 32 bits sem sinal", () => {
  for (const nome of ["", "a", "tdd-guide", "agente com acento ção"]) {
    const valor = hashNome(nome);
    assert.ok(Number.isInteger(valor));
    assert.ok(valor >= 0 && valor <= 0xffffffff);
  }
});

test("hashNome diferencia nomes parecidos", () => {
  assert.notEqual(hashNome("planner"), hashNome("planners"));
  assert.notEqual(hashNome("ab"), hashNome("ba"));
});

test("mesmo agente sempre recebe a mesma aparência", () => {
  // Arrange
  const primeira = aparenciaDoAgente("code-reviewer");

  // Act
  const segunda = aparenciaDoAgente("code-reviewer");

  // Assert
  assert.deepEqual(segunda, primeira);
});

test("agentes diferentes costumam receber aparências diferentes", () => {
  // Arrange
  const assinaturas = new Set(
    NOMES_DE_AGENTES.map((nome) => JSON.stringify(aparenciaDoAgente(nome))),
  );

  // Assert
  assert.ok(
    assinaturas.size >= NOMES_DE_AGENTES.length - 1,
    `esperado quase todas distintas, obtido ${assinaturas.size} de ${NOMES_DE_AGENTES.length}`,
  );
});

test("cores e acessório sempre pertencem às paletas", () => {
  for (const nome of NOMES_DE_AGENTES) {
    // Act
    const aparencia = aparenciaDoAgente(nome);

    // Assert
    assert.ok((PALETA_ROUPAS as readonly string[]).includes(aparencia.corRoupa));
    assert.ok((PALETA_CABELOS as readonly string[]).includes(aparencia.corCabelo));
    assert.ok((PALETA_PELES as readonly string[]).includes(aparencia.corPele));
    assert.ok((ACESSORIOS as readonly string[]).includes(aparencia.acessorio));
    assert.ok((PALETA_ACESSORIOS as readonly string[]).includes(aparencia.corAcessorio));
  }
});

test("paletas de roupa e acessório usam cores em formato hexadecimal", () => {
  const formatoHex = /^#[0-9a-f]{6}$/;
  for (const cor of [...PALETA_ROUPAS, ...PALETA_CABELOS, ...PALETA_PELES, ...PALETA_ACESSORIOS]) {
    assert.match(cor, formatoHex);
  }
});

test("acessórios variam entre os agentes e incluem o caso sem acessório", () => {
  // Arrange
  const usados = new Set<string>();
  for (let indice = 0; indice < 200; indice += 1) {
    usados.add(aparenciaDoAgente(`agente-${indice}`).acessorio);
  }

  // Assert
  assert.equal(usados.size, ACESSORIOS.length);
});
