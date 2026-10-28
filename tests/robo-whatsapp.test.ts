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
  resumoHorario,
  proximaAbertura,
  roboPausado,
  textoMenu,
  lerTextos,
  opcoesAtivas,
  preencher,
  textoPlanos,
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

test("áudio/foto solto no menu e rajada logo após a resposta não viram 'não entendi'", () => {
  assert.deepEqual(decidir(estado("menu"), null, agora, true), { tipo: "ignorar" });
  const recem: EstadoRobo = {
    etapa: "menu",
    dados: {},
    atualizadoEm: new Date(agora.getTime() - 5_000).toISOString(),
  };
  assert.deepEqual(decidir(recem, "Aí é o 11 normal", agora), { tipo: "ignorar" });
  // Opção válida na rajada ainda vale.
  assert.deepEqual(decidir(recem, "1", agora), { tipo: "status" });
  // Esperando o aparelho, foto sem texto não repete a pergunta.
  assert.deepEqual(decidir(estado("orc_aparelho"), null, agora, true), { tipo: "ignorar" });
});

const planos = {
  mensal: "R$ 40,40",
  anual: "R$ 460,56",
  link: "https://srmpretech.online/cadastro",
};

test("opção 5 (planos) só existe no WhatsApp da SPACE TECH", () => {
  assert.equal(lerOpcao("5"), 5);
  assert.equal(lerOpcao("quero assinar o sistema"), 5);
  assert.equal(lerOpcao("quanto custa o sistema?"), 5);
  assert.equal(lerOpcao("o sistema do meu celular travou"), null);
  // Com planos: menu mostra a 5 e ela responde.
  assert.match(
    textoMenu({ loja: "SPACE TECH", nome: null, aberto: true, abre: null, planos }, true),
    /5️⃣ Planos do SPACE TECH/,
  );
  assert.deepEqual(decidir(estado("menu"), "5", agora, false, [1, 2, 3, 4, 5]), {
    tipo: "planos",
    saudacao: false,
  });
  assert.deepEqual(decidir(estado(null), "quais os planos?", agora, false, [1, 2, 3, 4, 5]), {
    tipo: "planos",
    saudacao: true,
  });
  // Em outra loja: sem 5 no menu e "5" não é opção.
  assert.doesNotMatch(
    textoMenu({ loja: "Loja X", nome: null, aberto: true, abre: null }, true),
    /5️⃣/,
  );
  assert.deepEqual(decidir(estado("menu"), "5", agora), { tipo: "nao_entendeu", erros: 1 });
  assert.deepEqual(decidir(estado(null), "quais os planos?", agora), {
    tipo: "menu",
    saudacao: true,
  });
});

test("texto dos planos traz preços e link de cadastro", () => {
  const t = textoPlanos(
    { loja: "SPACE TECH", nome: "Ana", aberto: true, abre: null, planos },
    true,
  );
  assert.match(t, /^Olá, Ana!/);
  assert.match(t, /Mensal: \*R\$ 40,40\*\/mês/);
  assert.match(t, /7 dias grátis/);
  assert.match(t, /srmpretech\.online\/cadastro/);
});

test("textos editados: vazio cai no padrão, opção desligada some e não vale", () => {
  const textos = lerTextos({
    saudacao: "E aí {nome}, aqui é a {loja}!",
    opcoes: { 1: "Cadê meu celular?", 3: "" },
    desligadas: [2, 4, 9],
  });
  assert.equal(textos.opcoes[3], "Garantia");
  assert.deepEqual(textos.desligadas, [2], "4 nunca desliga; 9 não existe");
  const ctx = { loja: "Loja X", nome: "Ana", aberto: true, abre: null, textos };
  const menu = textoMenu(ctx, true);
  assert.match(menu, /^E aí Ana, aqui é a Loja X!/);
  assert.match(menu, /1️⃣ Cadê meu celular\?/);
  assert.doesNotMatch(menu, /2️⃣/);
  assert.match(menu, /4️⃣ Falar com um atendente/);
  assert.deepEqual(opcoesAtivas(ctx), [1, 3, 4]);
  assert.deepEqual(decidir(estado("menu"), "2", agora, false, opcoesAtivas(ctx)), {
    tipo: "nao_entendeu",
    erros: 1,
  });
});

test("preencher: sem nome some a vírgula junto", () => {
  assert.equal(preencher("Olá, {nome}! 👋", { nome: null }), "Olá! 👋");
  assert.equal(preencher("Olá, {nome}! 👋", { nome: "Ana" }), "Olá, Ana! 👋");
});

test("planos: linha de preço sem valor sai inteira", () => {
  const t = textoPlanos(
    {
      loja: "S",
      nome: null,
      aberto: true,
      abre: null,
      planos: { mensal: "R$ 40,40", anual: null, link: "L" },
    },
    false,
  );
  assert.match(t, /Mensal/);
  assert.doesNotMatch(t, /Anual/);
});

test("resumoHorario agrupa dias seguidos com o mesmo expediente", () => {
  assert.equal(resumoHorario(HORARIO_COMERCIAL), "Seg a Sex 8h–18h · Sáb 8h–12h");
  const h = [...HORARIO_COMERCIAL];
  h[3] = { abre: "13:30", fecha: "18:00" };
  h[0] = { abre: "09:00", fecha: "12:00" };
  assert.equal(
    resumoHorario(h),
    "Seg e Ter 8h–18h · Qua 13h30–18h · Qui e Sex 8h–18h · Sáb 8h–12h · Dom 9h–12h",
  );
  assert.equal(resumoHorario([null, null, null, null, null, null, null]), "");
});
