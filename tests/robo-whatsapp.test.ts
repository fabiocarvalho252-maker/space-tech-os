// Testes do robô de atendimento do WhatsApp (sem banco nem Evolution). Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HORARIO_COMERCIAL,
  decidir,
  estaAberto,
  etapaVigente,
  fimDaPausaAtendente,
  lerHorario,
  lerOpcao,
  primeiroNome,
  proximaAbertura,
  roboPausado,
  textoMenu,
  textoStatus,
  type EstadoRobo,
} from "../src/lib/whatsapp/robo.ts";

// Brasília é UTC-3. 2026-10-28 é quarta-feira.
const brt = (dataHora: string) => new Date(`${dataHora}:00-03:00`);
const qua = (hhmm: string) => brt(`2026-10-28T${hhmm}`);

test("horário comercial: aberto e fechado nas bordas", () => {
  assert.equal(estaAberto(HORARIO_COMERCIAL, qua("07:59")), false);
  assert.equal(estaAberto(HORARIO_COMERCIAL, qua("08:00")), true);
  assert.equal(estaAberto(HORARIO_COMERCIAL, qua("17:59")), true);
  assert.equal(estaAberto(HORARIO_COMERCIAL, qua("18:00")), false);
  assert.equal(estaAberto(HORARIO_COMERCIAL, brt("2026-10-31T11:00")), true); // sábado
  assert.equal(estaAberto(HORARIO_COMERCIAL, brt("2026-10-31T12:30")), false);
  assert.equal(estaAberto(HORARIO_COMERCIAL, brt("2026-11-01T10:00")), false); // domingo
});

test("próxima abertura: hoje, amanhã e depois do fim de semana", () => {
  assert.equal(proximaAbertura(HORARIO_COMERCIAL, qua("06:00")), "hoje às 8h");
  assert.equal(proximaAbertura(HORARIO_COMERCIAL, qua("19:00")), "amanhã às 8h");
  assert.equal(proximaAbertura(HORARIO_COMERCIAL, brt("2026-10-31T13:00")), "segunda às 8h");
  assert.equal(proximaAbertura([null, null, null, null, null, null, null], qua("10:00")), null);
});

test("pausa depois de chamar atendente: 3 h aberto, até 3 h depois de abrir fechado", () => {
  const aberto = qua("10:00");
  assert.equal(
    fimDaPausaAtendente(HORARIO_COMERCIAL, aberto).getTime() - aberto.getTime(),
    3 * 3_600_000,
  );
  const sexta22 = brt("2026-10-30T22:00");
  assert.equal(
    fimDaPausaAtendente(HORARIO_COMERCIAL, sexta22).toISOString(),
    brt("2026-10-31T11:00").toISOString(),
  );
});

test("horário torto no banco cai no comercial ou fecha o dia", () => {
  assert.deepEqual(lerHorario(null), HORARIO_COMERCIAL);
  const h = lerHorario([
    null,
    { abre: "18:00", fecha: "08:00" },
    { abre: "9:00", fecha: "17:00" },
    null,
    null,
    null,
    { abre: "08:00", fecha: "12:00" },
  ]);
  assert.equal(h[1], null);
  assert.equal(h[2], null);
  assert.deepEqual(h[6], { abre: "08:00", fecha: "12:00" });
});

test("lerOpcao: números, emoji e palavras-chave", () => {
  assert.equal(lerOpcao("1"), 1);
  assert.equal(lerOpcao(" 2. "), 2);
  assert.equal(lerOpcao("4️⃣"), 4);
  assert.equal(lerOpcao("opção 3"), 3);
  assert.equal(lerOpcao("Quero falar com um ATENDENTE"), 4);
  assert.equal(lerOpcao("meu celular já ficou pronto?"), 1);
  assert.equal(lerOpcao("quanto custa trocar a tela"), 2);
  assert.equal(lerOpcao("menu"), 0);
  assert.equal(lerOpcao("12"), null);
  assert.equal(lerOpcao("oi"), null);
  assert.equal(lerOpcao(null), null);
});

const agora = qua("10:00");
const estado = (etapa: string | null, minutosAtras = 1, dados = {}): EstadoRobo => ({
  etapa,
  dados,
  atualizadoEm: new Date(agora.getTime() - minutosAtras * 60_000).toISOString(),
});

test("conversa nova recebe o menu com saudação; pedido de atendente vai direto", () => {
  assert.deepEqual(decidir(estado(null), "oi", agora), { tipo: "menu", saudacao: true });
  assert.deepEqual(decidir(estado(null), "atendente por favor", agora), {
    tipo: "atendente",
    motivo: "pedido",
  });
});

test("etapa expira em 30 min e recomeça do menu", () => {
  assert.equal(etapaVigente(estado("menu", 29), agora), "menu");
  assert.equal(etapaVigente(estado("menu", 31), agora), null);
  assert.deepEqual(decidir(estado("menu", 31), "1", agora), { tipo: "menu", saudacao: true });
});

test("menu: opções 1 a 4 e 0 volta ao menu", () => {
  assert.deepEqual(decidir(estado("menu"), "1", agora), { tipo: "status" });
  assert.deepEqual(decidir(estado("menu"), "2", agora), { tipo: "orc_aparelho" });
  assert.deepEqual(decidir(estado("menu"), "3", agora), { tipo: "garantia" });
  assert.deepEqual(decidir(estado("menu"), "4", agora), { tipo: "atendente", motivo: "pedido" });
  assert.deepEqual(decidir(estado("menu"), "0", agora), { tipo: "menu", saudacao: false });
});

test("três respostas que não entende chamam um atendente", () => {
  assert.deepEqual(decidir(estado("menu"), "hã?", agora), { tipo: "nao_entendeu", erros: 1 });
  assert.deepEqual(decidir(estado("menu", 1, { erros: 1 }), "??", agora), {
    tipo: "nao_entendeu",
    erros: 2,
  });
  assert.deepEqual(decidir(estado("menu", 1, { erros: 2 }), "??", agora), {
    tipo: "atendente",
    motivo: "nao_entendeu",
  });
});

test("orçamento: pergunta aparelho, depois defeito, e registra", () => {
  assert.deepEqual(decidir(estado("orc_aparelho"), "  iPhone   11 ", agora), {
    tipo: "orc_defeito",
    aparelho: "iPhone 11",
  });
  assert.deepEqual(
    decidir(estado("orc_defeito", 1, { aparelho: "iPhone 11" }), "tela quebrada", agora),
    {
      tipo: "orc_registrar",
      aparelho: "iPhone 11",
      defeito: "tela quebrada",
    },
  );
  // Foto/áudio sem texto também vale como defeito.
  assert.deepEqual(decidir(estado("orc_defeito", 1, { aparelho: "A32" }), null, agora, true), {
    tipo: "orc_registrar",
    aparelho: "A32",
    defeito: "(enviou foto/áudio)",
  });
  // No meio do orçamento, "4" ainda chama atendente.
  assert.deepEqual(decidir(estado("orc_aparelho"), "4", agora), {
    tipo: "atendente",
    motivo: "pedido",
  });
});

test("pausa por tempo e 'infinity'", () => {
  assert.equal(roboPausado(null, agora), false);
  assert.equal(roboPausado("infinity", agora), true);
  assert.equal(roboPausado(new Date(agora.getTime() + 60_000).toISOString(), agora), true);
  assert.equal(roboPausado(new Date(agora.getTime() - 60_000).toISOString(), agora), false);
});

test("primeiro nome: capitaliza e ignora emoji/número", () => {
  assert.equal(primeiroNome("suzana lindaura"), "Suzana");
  assert.equal(primeiroNome("🔥🔥"), null);
  assert.equal(primeiroNome("5574999"), null);
  assert.equal(primeiroNome(null), null);
});

test("menu fora do horário diz quando volta", () => {
  const t = textoMenu(
    { loja: "SPACE TECH", nome: "Ana", aberto: false, abre: "amanhã às 8h" },
    true,
  );
  assert.match(t, /Olá, Ana!/);
  assert.match(t, /fechados — voltamos amanhã às 8h/);
  assert.match(t, /4️⃣ Falar com um atendente/);
});

test("status: pronta mostra valor; sem OS orienta a falar com atendente", () => {
  const t = textoStatus([
    {
      numero: 23,
      aparelho: "iPhone 11",
      status: "pronto",
      statusLabel: "Pronto",
      previsao: null,
      valor: "R$ 250,00",
    },
    {
      numero: 24,
      aparelho: "A32",
      status: "em_reparo",
      statusLabel: "Em reparo",
      previsao: "2026-10-30",
      valor: null,
    },
  ]);
  assert.match(t, /OS #23\* — iPhone 11\n\*Pronta para retirada!\* Valor: R\$ 250,00/);
  assert.match(t, /Status: \*Em reparo\*\nPrevisão: 30\/10\/2026/);
  assert.match(textoStatus([]), /responda \*4\*/);
});
