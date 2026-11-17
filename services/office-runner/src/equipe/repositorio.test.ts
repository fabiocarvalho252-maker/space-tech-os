import { test } from "node:test";
import assert from "node:assert/strict";
import { criarRepositorioEquipe, linhaDoPerfil, perfilDaLinha, TABELA_PERFIS, type ClienteEquipe } from "./repositorio.ts";
import { perfilPadrao } from "./perfis.ts";

const AGORA = "2026-11-17T12:00:00.000Z";

function linhaValida(): Record<string, unknown> {
  return {
    agent_id: "planner",
    kind: "agent",
    display_name: "Pauleta",
    role_title: "Planejadora",
    summary_pt_br: "Resumo",
    description_pt_br: "Descrição",
    when_to_use: ["a", "b", "c"],
    sector: "planejamento",
    appearance: { seed: "planner" },
    original_description: "Planeja",
    source_hash: "abc",
    edited: true,
    updated_at: AGORA,
  };
}

function clienteFalso(resposta: { data?: unknown[] | null; error: { message: string } | null }) {
  const chamadas: { tabela: string; linha?: unknown; opcoes?: unknown }[] = [];
  const cliente: ClienteEquipe = {
    from(tabela) {
      chamadas.push({ tabela });
      return {
        select: () => Promise.resolve(resposta),
        upsert: (linha, opcoes) => {
          chamadas.push({ tabela, linha, opcoes });
          return Promise.resolve({ error: resposta.error });
        },
      };
    },
  };
  return { cliente, chamadas };
}

test("linha do perfil usa colunas snake_case e carimba updated_at", () => {
  const linha = linhaDoPerfil(perfilPadrao({ id: "planner", nome: "planner", descricao: "Planeja", setor: "planejamento", tipo: "agente" }), AGORA);
  assert.equal(linha.agent_id, "planner");
  assert.equal(linha.display_name, "planner");
  assert.equal(linha.updated_at, AGORA);
});

test("perfilDaLinha converte uma linha válida", () => {
  const perfil = perfilDaLinha(linhaValida());
  assert.equal(perfil.agentId, "planner");
  assert.equal(perfil.displayName, "Pauleta");
  assert.deepEqual(perfil.whenToUse, ["a", "b", "c"]);
  assert.equal(perfil.edited, true);
});

test("perfilDaLinha recusa linha fora do contrato com erro que cita o agente", () => {
  assert.throws(() => perfilDaLinha({ ...linhaValida(), kind: "outro" }), /Perfil salvo inválido no banco: planner/);
});

test("listar lê a tabela e converte as linhas", async () => {
  const { cliente, chamadas } = clienteFalso({ data: [linhaValida()], error: null });
  const perfis = await criarRepositorioEquipe(cliente).listar();
  assert.equal(perfis.length, 1);
  assert.equal(chamadas[0]?.tabela, TABELA_PERFIS);
});

test("listar propaga erro do banco com mensagem clara", async () => {
  const { cliente } = clienteFalso({ data: null, error: { message: "timeout" } });
  await assert.rejects(criarRepositorioEquipe(cliente).listar(), /Falha ao ler a Equipe: timeout/);
});

test("salvar faz upsert pela chave agent_id", async () => {
  const { cliente, chamadas } = clienteFalso({ error: null });
  const perfil = perfilDaLinhaParaSalvar();
  await criarRepositorioEquipe(cliente, () => AGORA).salvar(perfil);
  const upsert = chamadas.find((c) => c.opcoes !== undefined);
  assert.deepEqual(upsert?.opcoes, { onConflict: "agent_id" });
  assert.equal((upsert?.linha as { updated_at: string }).updated_at, AGORA);
});

test("salvar propaga erro do banco", async () => {
  const { cliente } = clienteFalso({ error: { message: "violação de regra" } });
  await assert.rejects(criarRepositorioEquipe(cliente).salvar(perfilDaLinhaParaSalvar()), /Falha ao salvar o agente planner/);
});

function perfilDaLinhaParaSalvar() {
  return perfilDaLinha(linhaValida());
}
