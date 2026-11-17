// Testes da camada pura da Equipe em português: rótulos de ferramenta,
// validação do perfil gerado e unicidade de nomes. Sem React, banco ou rede.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rotuloFerramenta } from "../src/features/escritorio/equipe/rotulosFerramentas.ts";
import { validarPerfilGerado } from "../src/features/escritorio/equipe/validacaoPerfil.ts";
import { validarNomeUnico } from "../src/features/escritorio/equipe/nomes.ts";

function perfilValido(): Record<string, unknown> {
  return {
    displayName: "Ana Planner",
    roleTitle: "Planejadora de missões",
    summaryPtBr: "Organiza as etapas do trabalho antes da execução.",
    descriptionPtBr: "Quebra pedidos grandes em passos menores e claros.",
    whenToUse: ["Pedidos com várias etapas", "Mudanças grandes", "Quando falta um plano"],
  };
}

test("rotulo conhecido devolve o balão em português", () => {
  assert.equal(rotuloFerramenta("Read"), "Lendo arquivo");
  assert.equal(rotuloFerramenta("MultiEdit"), "Editando arquivo");
  assert.equal(rotuloFerramenta("Agent"), "Passando tarefa");
});

test("rotulo desconhecido usa o nome da ferramenta", () => {
  assert.equal(rotuloFerramenta("Minhatool"), "Usando Minhatool");
});

test("rotulo com nome vazio ou só espaços usa texto genérico", () => {
  assert.equal(rotuloFerramenta(""), "Usando uma ferramenta");
  assert.equal(rotuloFerramenta("   "), "Usando uma ferramenta");
});

test("perfil válido é aceito e devolvido", () => {
  const resultado = validarPerfilGerado(perfilValido());
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.equal(resultado.valor.displayName, "Ana Planner");
});

test("perfil sem campo obrigatório é recusado com mensagem em português", () => {
  const entrada = perfilValido();
  delete entrada["roleTitle"];
  const resultado = validarPerfilGerado(entrada);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.ok(resultado.erros.some((erro) => erro.startsWith("roleTitle:")));
    assert.ok(resultado.erros.some((erro) => erro.includes("é obrigatório")));
  }
});

test("whenToUse com dois itens é recusado", () => {
  const entrada = { ...perfilValido(), whenToUse: ["Um", "Dois"] };
  const resultado = validarPerfilGerado(entrada);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.ok(resultado.erros.some((erro) => erro.includes("exatamente 3 itens")));
  }
});

test("nome com mais de 24 caracteres é recusado", () => {
  const entrada = { ...perfilValido(), displayName: "A".repeat(25) };
  const resultado = validarPerfilGerado(entrada);
  assert.equal(resultado.ok, false);
  if (!resultado.ok) {
    assert.ok(resultado.erros.some((erro) => erro.startsWith("displayName:")));
  }
});

test("nome vazio é vazio em validarNomeUnico", () => {
  assert.equal(validarNomeUnico("   ", []), "Dê um nome para o agente.");
});

test("nome longo é recusado em validarNomeUnico", () => {
  assert.equal(validarNomeUnico("A".repeat(25), []), "Use no máximo 24 caracteres.");
});

test("nome duplicado ignora acento e diferença de maiúsculas", () => {
  assert.equal(validarNomeUnico("  ANÁLISE ", ["analise"]), "Já existe um agente com esse nome.");
});

test("nome único é aceito", () => {
  assert.equal(validarNomeUnico("Bruno", ["Ana", "Carla"]), null);
});
