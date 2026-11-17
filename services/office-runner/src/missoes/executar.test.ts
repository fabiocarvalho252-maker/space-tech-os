import { test } from "node:test";
import assert from "node:assert/strict";
import { criarRepositorio } from "./repositorio.ts";
import { executarMissao, type Consulta } from "./executar.ts";
import type { EventoEscritorio } from "../tipos.ts";

const LIMITES = {
  projetoRaiz: "/srv/office/projects",
  maxTurns: 10,
  maxCustoUsd: 1,
  maxMinutos: 1,
  timeoutAprovacaoMs: 5000,
};

async function* roteiroSimples() {
  yield { type: "system", subtype: "init" };
  yield { type: "result", subtype: "success", is_error: false, result: "Feito.", total_cost_usd: 0.01, usage: { input_tokens: 1, output_tokens: 1 } };
}

function coletar(repo: ReturnType<typeof criarRepositorio>, missaoId: string): EventoEscritorio[] {
  return repo.replay(undefined, missaoId);
}

test("missão feliz termina concluída e guarda os eventos", async () => {
  const repo = criarRepositorio();
  const missao = repo.criar("liste arquivos", "loja", "seguro");
  const consulta: Consulta = () => roteiroSimples();
  await executarMissao(missao, repo, consulta, LIMITES);
  assert.equal(repo.obter(missao.id)?.status, "concluida");
  assert.equal(coletar(repo, missao.id).at(-1)?.tipo, "missao.concluida");
});

test("erro do SDK vira missão falhou, sem derrubar o processo", async () => {
  const repo = criarRepositorio();
  const missao = repo.criar("x", "loja", "seguro");
  const consulta: Consulta = () => {
    throw new Error("SDK indisponível");
  };
  await executarMissao(missao, repo, consulta, LIMITES);
  assert.equal(repo.obter(missao.id)?.status, "falhou");
  assert.equal(coletar(repo, missao.id).at(-1)?.texto, "SDK indisponível");
});

test("pedido de aprovação espera a decisão e segue quando permitido", async () => {
  const repo = criarRepositorio();
  const missao = repo.criar("edite", "loja", "seguro");
  let resultadoPermissao: unknown;
  const consulta: Consulta = (params) => {
    void params;
    return (async function* () {
      yield { type: "system", subtype: "init" };
      const opcoes = (params.options as { canUseTool: (t: string, i: Record<string, unknown>, o: unknown) => Promise<unknown> });
      resultadoPermissao = await opcoes.canUseTool("Edit", { file_path: "src/a.ts" }, {});
      yield { type: "result", subtype: "success", is_error: false, result: "ok", total_cost_usd: 0, usage: {} };
    })();
  };
  const execucao = executarMissao(missao, repo, consulta, LIMITES);
  await new Promise((r) => setTimeout(r, 20));
  const pedido = coletar(repo, missao.id).find((e) => e.tipo === "aprovacao.pedida");
  assert.ok(pedido?.aprovacao, "deve pedir aprovação");
  assert.equal(repo.decidirAprovacao(pedido.aprovacao.id, "permitir"), true);
  await execucao;
  assert.deepEqual(resultadoPermissao, { behavior: "allow", updatedInput: { file_path: "src/a.ts" } });
});

test("aprovação sem resposta expira e nega", async () => {
  const repo = criarRepositorio();
  const missao = repo.criar("edite", "loja", "seguro");
  let decisao: unknown;
  const consulta: Consulta = (params) =>
    (async function* () {
      yield { type: "system", subtype: "init" };
      const opcoes = params.options as { canUseTool: (t: string, i: Record<string, unknown>, o: unknown) => Promise<unknown> };
      decisao = await opcoes.canUseTool("Write", { file_path: "src/b.ts" }, {});
      yield { type: "result", subtype: "success", is_error: false, result: "", total_cost_usd: 0, usage: {} };
    })();
  await executarMissao(missao, repo, consulta, { ...LIMITES, timeoutAprovacaoMs: 30 });
  assert.equal((decisao as { behavior: string }).behavior, "deny");
});

test("cancelar a missão em andamento marca como cancelada", async () => {
  const repo = criarRepositorio();
  const missao = repo.criar("longo", "loja", "seguro");
  const consulta: Consulta = (params) =>
    (async function* () {
      yield { type: "system", subtype: "init" };
      await new Promise((_, rejeitar) => {
        params.options?.abortController?.signal.addEventListener("abort", () => rejeitar(new Error("abortado")));
      });
    })();
  const execucao = executarMissao(missao, repo, consulta, LIMITES);
  await new Promise((r) => setTimeout(r, 10));
  missao.controlador.abort(new Error("cancelada pelo administrador"));
  await execucao;
  assert.equal(repo.obter(missao.id)?.status, "cancelada");
  assert.equal(coletar(repo, missao.id).at(-1)?.tipo, "missao.cancelada");
});

test("ambiente do SDK só leva variáveis da lista permitida", async () => {
  const { ambienteSemChaveApi } = await import("./executar.ts");
  const limpo = ambienteSemChaveApi({
    ANTHROPIC_API_KEY: "x",
    ANTHROPIC_AUTH_TOKEN: "y",
    SUPABASE_SERVICE_ROLE_KEY: "z",
    ADMIN_EMAIL: "a@b.c",
    HOME: "/root",
    PATH: "/bin",
  });
  assert.equal("ANTHROPIC_API_KEY" in limpo, false);
  assert.equal("SUPABASE_SERVICE_ROLE_KEY" in limpo, false);
  assert.equal("ADMIN_EMAIL" in limpo, false);
  assert.equal(limpo["HOME"], "/root");
});
