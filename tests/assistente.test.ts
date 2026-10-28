// Testes das regras do assistente do sistema (sem banco). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dispensar,
  filtrarSugestoes,
  montarSugestoes,
  PREFERENCIAS_PADRAO,
  type DadosAssistente,
  type OsAssistente,
} from "../src/lib/assistente/sugestoes.ts";

const agora = new Date("2026-10-27T15:00:00-03:00");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

const vazio: DadosAssistente = {
  os: [],
  cobrancasVencidas: [],
  contasPagarVencidas: [],
  receberAtrasados: [],
  estoqueBaixo: [],
  agendaHoje: [],
  whatsappNaoLidas: 0,
  reclamacoes: 0,
  totais: { clientes: 10, os: 10, produtos: 10 },
};

function os(parcial: Partial<OsAssistente>): OsAssistente {
  return {
    id: "a",
    numero: 1,
    status: "em_reparo",
    updated_at: diasAtras(0),
    previsao: null,
    aparelho: "iPhone 11",
    cliente: "Maria Souza",
    ...parcial,
  };
}

test("sem nada pendente sobra só a dica do dia", () => {
  const s = montarSugestoes(vazio, agora);
  assert.equal(s.length, 1);
  assert.equal(s[0]!.categoria, "dicas");
});

test("conta nova recebe as dicas de primeiros passos", () => {
  const s = montarSugestoes({ ...vazio, totais: { clientes: 0, os: 0, produtos: 0 } }, agora);
  assert.deepEqual(
    s.map((x) => x.chave),
    ["dica:primeiro-cliente", "dica:primeira-os", "dica:primeiro-produto"],
  );
});

test("OS parada só a partir de 3 dias e com link para a OS", () => {
  assert.equal(
    montarSugestoes({ ...vazio, os: [os({ updated_at: diasAtras(2) })] }, agora).length,
    1,
  );
  const s = montarSugestoes({ ...vazio, os: [os({ updated_at: diasAtras(4) })] }, agora);
  assert.equal(s[0]!.titulo, "OS parada há 4 dias");
  assert.match(s[0]!.pergunta, /OS #1 \(iPhone 11 de Maria\)/);
  assert.deepEqual(s[0]!.acoes[0], { rotulo: "Abrir OS", to: "/ordens", search: { os: "a" } });
});

test("cada OS gera uma sugestão só, a mais específica", () => {
  const s = montarSugestoes(
    { ...vazio, os: [os({ updated_at: diasAtras(10), previsao: "2026-10-20" })] },
    agora,
  );
  const deOs = s.filter((x) => x.categoria === "os");
  assert.equal(deOs.length, 1);
  assert.equal(deOs[0]!.titulo, "Previsão de entrega vencida");
  assert.equal(deOs[0]!.prioridade, 1);
});

test("OS pronta com previsão passada não é tratada como atrasada", () => {
  const s = montarSugestoes(
    { ...vazio, os: [os({ status: "pronto", updated_at: diasAtras(3), previsao: "2026-10-20" })] },
    agora,
  );
  assert.equal(s[0]!.titulo, "Pronta há 3 dias e não retirada");
});

test("aguardando peça oferece consultar fornecedor", () => {
  const s = montarSugestoes(
    { ...vazio, os: [os({ status: "aguardando_peca", updated_at: diasAtras(6) })] },
    agora,
  );
  assert.deepEqual(
    s[0]!.acoes.map((a) => a.to),
    ["/ordens", "/fornecedores"],
  );
});

test("mais de 3 OS viram 3 sugestões e um resumo", () => {
  const lista = [1, 2, 3, 4, 5].map((n) =>
    os({ id: String(n), numero: n, updated_at: diasAtras(10 - n) }),
  );
  const deOs = montarSugestoes({ ...vazio, os: lista }, agora).filter((x) => x.categoria === "os");
  assert.equal(deOs.length, 4);
  assert.deepEqual(
    deOs.slice(0, 3).map((x) => x.chave.split(":")[1]),
    ["1", "2", "3"],
  );
  assert.equal(deOs[3]!.titulo, "Mais 2 OS precisam de atenção");
});

test("prioridade 1 vem antes e soma valores em reais", () => {
  const s = montarSugestoes(
    {
      ...vazio,
      estoqueBaixo: [{ nome: "Tela" }],
      cobrancasVencidas: [{ valor: 50 }, { valor: 25.5 }],
    },
    agora,
  );
  assert.equal(s[0]!.categoria, "financeiro");
  assert.match(s[0]!.pergunta.replace(/\s/g, " "), /R\$ 75,50/);
  assert.equal(s[1]!.categoria, "estoque");
});

test("consulta que falhou (null) não gera sugestão nem quebra", () => {
  const s = montarSugestoes(
    {
      ...vazio,
      os: null,
      cobrancasVencidas: null,
      estoqueBaixo: null,
      whatsappNaoLidas: null,
      totais: { clientes: null, os: null, produtos: null },
    },
    agora,
  );
  assert.equal(s.length, 1);
});

test("filtro respeita desligado, categoria e dispensa com prazo", () => {
  const s = montarSugestoes({ ...vazio, estoqueBaixo: [{ nome: "Tela" }] }, agora);
  assert.equal(filtrarSugestoes(s, { ...PREFERENCIAS_PADRAO, ativo: false }, agora).length, 0);
  assert.equal(
    filtrarSugestoes(
      s,
      { ...PREFERENCIAS_PADRAO, categorias_desligadas: ["estoque", "dicas"] },
      agora,
    ).length,
    0,
  );
  const ate = new Date(agora.getTime() + 3_600_000);
  const dispensados = dispensar({ velho: diasAtras(1) }, "estoque:1", ate, agora);
  assert.deepEqual(Object.keys(dispensados), ["estoque:1"]); // o expirado foi limpo
  const visiveis = filtrarSugestoes(s, { ...PREFERENCIAS_PADRAO, dispensados }, agora);
  assert.equal(
    visiveis.some((x) => x.chave === "estoque:1"),
    false,
  );
  const depois = new Date(ate.getTime() + 1);
  assert.equal(
    filtrarSugestoes(s, { ...PREFERENCIAS_PADRAO, dispensados }, depois).some(
      (x) => x.chave === "estoque:1",
    ),
    true,
  );
});
