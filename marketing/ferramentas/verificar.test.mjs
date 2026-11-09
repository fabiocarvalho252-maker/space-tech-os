// Testes da conferência:  node --test marketing/ferramentas/verificar.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { verificarConteudo } from "./verificar.mjs";

const base = (status, extra = "") => `# XX-01 — Teste

- **ID:** XX-01
- **Plataforma:** Instagram
- **Objetivo:** teste
- **Status:** ${status}
- **Link:** https://srmpretech.online/?utm_source=instagram&utm_medium=bio&utm_campaign=lancamento-nov26

## Texto pronto para publicar

Teste grátis por 7 dias. Depois, R$ 40,00 por mês. ${extra}

## Chamada para ação
x
## Ideia de arte ou roteiro
x
## Fatos usados
x
## Aprovação

- Aprovado por:
- Data da aprovação:
- Plataformas autorizadas:
- Observações:

## Publicação

- Data e hora:
- Link do post:
`;

const aprovado = (t) =>
  t
    .replace("- Aprovado por:", "- Aprovado por: Fabio")
    .replace("- Data da aprovação:", "- Data da aprovação: 10/11/2026")
    .replace("- Plataformas autorizadas:", "- Plataformas autorizadas: Instagram");

test("conteúdo correto na pasta certa passa", () => {
  assert.deepEqual(verificarConteudo(base("AGUARDANDO APROVAÇÃO"), "aprovacao", "XX-01-a.md").erros, []);
});

test("status diferente da pasta é erro", () => {
  const { erros } = verificarConteudo(base("APROVADO"), "aprovacao", "XX-01-a.md");
  assert.ok(erros.some((e) => e.includes("não combina com a pasta")));
});

test("aprovado sem quem aprovou é erro", () => {
  const { erros } = verificarConteudo(base("APROVADO"), "aprovados", "XX-01-a.md");
  assert.ok(erros.some((e) => e.includes('"Aprovado por" vazio')));
  assert.deepEqual(verificarConteudo(aprovado(base("APROVADO")), "aprovados", "XX-01-a.md").erros, []);
});

test("publicado sem link do post é erro", () => {
  const { erros } = verificarConteudo(aprovado(base("PUBLICADO")), "publicados", "XX-01-a.md");
  assert.ok(erros.some((e) => e.includes('"Link do post" vazio')));
});

test("link do site sem UTM é erro", () => {
  const t = base("RASCUNHO").replace(/\?utm_source[^\s]+/, "");
  const { erros } = verificarConteudo(t, "conteudos", "XX-01-a.md");
  assert.ok(erros.some((e) => e.includes("utm_source")));
});

test("preço inventado e afirmações proibidas são erro", () => {
  const { erros } = verificarConteudo(
    base("RASCUNHO", "Promoção R$ 29,90! Emite nota fiscal, já na Play Store, o nº 1, resultado garantido."),
    "conteudos",
    "XX-01-a.md",
  );
  for (const trecho of ["R$ 29,90", "Nota Fiscal", "Play Store", "superlativo", "garantido"])
    assert.ok(erros.some((e) => e.includes(trecho)), `esperava erro sobre ${trecho}`);
});

test("'garantia' (recurso real) não é confundido com 'garantido'", () => {
  assert.deepEqual(
    verificarConteudo(base("RASCUNHO", "Termos de garantia na OS."), "conteudos", "XX-01-a.md").erros,
    [],
  );
});

test("anúncio pago precisa do aviso de orçamento", () => {
  const { erros } = verificarConteudo(base("RASCUNHO", "ANÚNCIO PAGO"), "conteudos", "XX-01-a.md");
  assert.ok(erros.some((e) => e.includes("exige autorização de orçamento")));
});

test("nome do arquivo precisa começar com o ID", () => {
  const { erros } = verificarConteudo(base("RASCUNHO"), "conteudos", "outro.md");
  assert.ok(erros.some((e) => e.includes("nome do arquivo")));
});
