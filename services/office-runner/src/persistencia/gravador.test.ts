import { test } from "node:test";
import assert from "node:assert/strict";
import { criarGravador, TAMANHO_LOTE, type ClienteBanco, type Resultado } from "./gravador.ts";
import type { EventoEscritorio } from "../tipos.ts";

type Chamada = { tabela: string; operacao: string; dados: unknown; filtro?: string };

function clienteFalso(erroEm?: string) {
  const chamadas: Chamada[] = [];
  const resultado = (tabela: string): Resultado => (erroEm === tabela ? { error: { message: "banco fora" } } : { error: null });
  const cliente: ClienteBanco = {
    from(tabela: string) {
      return {
        upsert: (dados) => {
          chamadas.push({ tabela, operacao: "upsert", dados });
          return Promise.resolve(resultado(tabela));
        },
        insert: (dados) => {
          chamadas.push({ tabela, operacao: "insert", dados });
          return Promise.resolve(resultado(tabela));
        },
        update: (dados) => ({
          eq: (coluna: string, valor: string) => {
            chamadas.push({ tabela, operacao: "update", dados, filtro: `${coluna}=${valor}` });
            return Promise.resolve(resultado(tabela));
          },
        }),
      };
    },
  };
  return { cliente, chamadas };
}

function evento(id: string, tipo: EventoEscritorio["tipo"], extra: Partial<EventoEscritorio> = {}): EventoEscritorio {
  return { id, missaoId: "m1", ts: "2026-11-17T12:00:00.000Z", agenteId: "orchestrator", tipo, ...extra };
}

test("missão criada vira linha em office_missions com status 'fila'", async () => {
  const { cliente, chamadas } = clienteFalso();
  const g = criarGravador(cliente, () => {});
  await g.missaoCriada({ id: "m1", criadoPor: "u1", prompt: "liste", projeto: "loja", modo: "seguro", criadaEm: "2026-11-17T12:00:00.000Z" });
  assert.equal(chamadas[0]?.tabela, "office_missions");
  assert.equal((chamadas[0]?.dados as { status: string }).status, "fila");
  assert.equal((chamadas[0]?.dados as { created_by: string }).created_by, "u1");
});

test("eventos são gravados em lote, sem perder nenhum", async () => {
  const { cliente, chamadas } = clienteFalso();
  const g = criarGravador(cliente, () => {});
  for (let i = 0; i < TAMANHO_LOTE + 3; i++) g.evento(evento(`e${i}`, "agente.mensagem", { texto: "oi" }));
  await g.esvaziar();
  const linhas = chamadas.filter((c) => c.tabela === "office_events").flatMap((c) => c.dados as unknown[]);
  assert.equal(linhas.length, TAMANHO_LOTE + 3);
});

test("missão concluída grava resultado, tokens e custo e fecha como concluida", async () => {
  const { cliente, chamadas } = clienteFalso();
  const g = criarGravador(cliente, () => {});
  g.evento(
    evento("f1", "missao.concluida", {
      resultado: "Pronto.",
      uso: { entradaTokens: 10, saidaTokens: 5, custoUsd: 0.4 },
    }),
  );
  await new Promise((r) => setTimeout(r, 30));
  const fecha = chamadas.find((c) => c.operacao === "update" && c.tabela === "office_missions");
  assert.equal(fecha?.filtro, "id=m1");
  const dados = fecha?.dados as { status: string; result_markdown: string; cost_usd: number };
  assert.equal(dados.status, "concluida");
  assert.equal(dados.result_markdown, "Pronto.");
  assert.equal(dados.cost_usd, 0.4);
});

test("aprovação pedida e decidida são gravadas", async () => {
  const { cliente, chamadas } = clienteFalso();
  const g = criarGravador(cliente, () => {});
  await g.aprovacaoPedida("m1", { id: "ap1", agenteId: "security-reviewer", ferramenta: "Edit", resumo: "a.ts" });
  await g.aprovacaoDecidida("ap1", "permitida", "u1");
  const ops = chamadas.filter((c) => c.tabela === "office_approvals").map((c) => c.operacao);
  assert.deepEqual(ops, ["insert", "update"]);
  assert.equal((chamadas[1]?.dados as { status: string }).status, "permitida");
});

test("falha no banco é reportada e não lança exceção para a missão", async () => {
  const erros: string[] = [];
  const { cliente } = clienteFalso("office_missions");
  const g = criarGravador(cliente, (msg) => erros.push(msg));
  await g.missaoCriada({ id: "m1", criadoPor: "u1", prompt: "x", projeto: "loja", modo: "seguro", criadaEm: "2026-11-17T12:00:00.000Z" });
  assert.equal(erros.length, 1);
  assert.match(erros[0] ?? "", /banco fora/);
});
