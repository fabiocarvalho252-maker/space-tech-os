// Robô de atendimento do WhatsApp (Configurações > WhatsApp > Robô de
// atendimento). Só responde a quem escreve para a loja, com um menu fixo:
// status da OS, pedido de orçamento, garantia e falar com um atendente.
// Nada de IA nem de preço/prazo inventado — os dados vêm do sistema.
// Este arquivo é puro (sem banco e sem imports "@/") para rodar no
// `node --test`; quem busca os dados e envia é robo.server.ts.

// ---------------------------------------------------------------------
// Horário de atendimento (Brasília, UTC-3 sem horário de verão desde 2019)
// ---------------------------------------------------------------------

export type Expediente = { abre: string; fecha: string } | null;
/** 7 posições, 0 = domingo … 6 = sábado; null = fechado. */
export type Horario = Expediente[];

export const DIAS_SEMANA = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

export const HORARIO_COMERCIAL: Horario = [
  null,
  { abre: "08:00", fecha: "18:00" },
  { abre: "08:00", fecha: "18:00" },
  { abre: "08:00", fecha: "18:00" },
  { abre: "08:00", fecha: "18:00" },
  { abre: "08:00", fecha: "18:00" },
  { abre: "08:00", fecha: "12:00" },
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

/** Aceita o que vem do banco (jsonb) e cai no horário comercial se estiver torto. */
export function lerHorario(valor: unknown): Horario {
  if (!Array.isArray(valor) || valor.length !== 7) return HORARIO_COMERCIAL;
  return valor.map((d) => {
    if (!d || typeof d !== "object") return null;
    const { abre, fecha } = d as Record<string, unknown>;
    if (typeof abre !== "string" || typeof fecha !== "string") return null;
    if (!HHMM.test(abre) || !HHMM.test(fecha) || minutos(fecha) <= minutos(abre)) return null;
    return { abre, fecha };
  });
}

/** Dia da semana e minutos desde 00:00 no horário de Brasília. */
export function agoraBrasilia(agora: Date): { dia: number; min: number } {
  const brt = new Date(agora.getTime() - 3 * 3_600_000);
  return { dia: brt.getUTCDay(), min: brt.getUTCHours() * 60 + brt.getUTCMinutes() };
}

export function estaAberto(horario: Horario, agora: Date): boolean {
  const { dia, min } = agoraBrasilia(agora);
  const exp = horario[dia];
  return !!exp && min >= minutos(exp.abre) && min < minutos(exp.fecha);
}

function hora(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** "hoje às 14h", "amanhã às 8h", "segunda às 8h" — null se nunca abre. */
export function proximaAbertura(horario: Horario, agora: Date): string | null {
  const { dia, min } = agoraBrasilia(agora);
  for (let i = 0; i < 8; i++) {
    const d = (dia + i) % 7;
    const exp = horario[d];
    if (!exp) continue;
    if (i === 0 && min >= minutos(exp.abre)) continue;
    const quando = i === 0 ? "hoje" : i === 1 ? "amanhã" : DIAS_SEMANA[d];
    return `${quando} às ${hora(exp.abre)}`;
  }
  return null;
}

/** Até quando o robô fica quieto depois de chamar um atendente. */
export function fimDaPausaAtendente(horario: Horario, agora: Date): Date {
  const TRES_HORAS = 3 * 3_600_000;
  if (estaAberto(horario, agora)) return new Date(agora.getTime() + TRES_HORAS);
  // Fechado: até 3 h depois da próxima abertura (a equipe tem tempo de responder).
  const { dia, min } = agoraBrasilia(agora);
  for (let i = 0; i < 8; i++) {
    const d = (dia + i) % 7;
    const exp = horario[d];
    if (!exp || (i === 0 && min >= minutos(exp.abre))) continue;
    const ate = i * 1440 + minutos(exp.abre) - min;
    return new Date(agora.getTime() + ate * 60_000 + TRES_HORAS);
  }
  return new Date(agora.getTime() + 12 * 3_600_000);
}

// ---------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------

export type Etapa = "menu" | "orc_aparelho" | "orc_defeito";
export type DadosRobo = { aparelho?: string; erros?: number };
export type EstadoRobo = { etapa: string | null; dados: DadosRobo; atualizadoEm: string | null };

/** Sem resposta do cliente por esse tempo, a próxima mensagem recomeça do menu. */
export const VALIDADE_ETAPA_MS = 30 * 60_000;
const MAX_TEXTO = 300;

export function etapaVigente(estado: EstadoRobo, agora: Date): Etapa | null {
  const e = estado.etapa;
  if (e !== "menu" && e !== "orc_aparelho" && e !== "orc_defeito") return null;
  if (!estado.atualizadoEm) return null;
  return agora.getTime() - new Date(estado.atualizadoEm).getTime() <= VALIDADE_ETAPA_MS ? e : null;
}

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Opcao = 0 | 1 | 2 | 3 | 4;

/** Número do menu (também "1.", "1️⃣", "opção 2") ou palavra-chave clara. */
export function lerOpcao(texto: string | null): Opcao | null {
  const t = normalizar(texto ?? "");
  if (!t) return null;
  const numero = t.match(/^(?:opcao |op )?([0-4])$/);
  if (numero) return Number(numero[1]) as Opcao;
  if (/^(menu|inicio|voltar ao menu)$/.test(t)) return 0;
  if (/\b(atendente|humano|pessoa|falar com alguem|falar com voce|vendedor)\b/.test(t)) return 4;
  if (/\bgarantia\b/.test(t)) return 3;
  if (/\b(orcamento|conserto|consertar|arrumar|quanto custa|quanto fica|valor do)\b/.test(t))
    return 2;
  if (/\b(status|minha os|ordem de servico|ficou pronto|ta pronto|esta pronto|ja ficou)\b/.test(t))
    return 1;
  return null;
}

export type Decisao =
  | { tipo: "menu"; saudacao: boolean }
  | { tipo: "status" }
  | { tipo: "garantia" }
  | { tipo: "orc_aparelho" }
  | { tipo: "orc_defeito"; aparelho: string }
  | { tipo: "orc_registrar"; aparelho: string; defeito: string }
  | { tipo: "atendente"; motivo: "pedido" | "nao_entendeu" }
  | { tipo: "nao_entendeu"; erros: number }
  /** Áudio/foto solto ou mensagem em rajada logo depois da resposta: não responde. */
  | { tipo: "ignorar" };

/** Mensagem que chega até esse tempo depois da resposta do robô é o cliente
 * ainda digitando (rajada): sem "não entendi" para cada uma. */
export const RAJADA_MS = 20_000;

function limitar(texto: string): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
}

/** O próximo passo da conversa a partir da mensagem do cliente. */
export function decidir(
  estado: EstadoRobo,
  texto: string | null,
  agora: Date,
  temMidia = false,
): Decisao {
  const etapa = etapaVigente(estado, agora);
  const opcao = lerOpcao(texto);
  const livre = limitar(texto ?? "");

  if (etapa === null) {
    // Começo de conversa: quem já chega pedindo algo claro vai direto.
    if (opcao === 4) return { tipo: "atendente", motivo: "pedido" };
    return { tipo: "menu", saudacao: true };
  }
  if (opcao === 0) return { tipo: "menu", saudacao: false };
  if (opcao === 4) return { tipo: "atendente", motivo: "pedido" };

  if (etapa === "orc_aparelho") {
    if (!livre) return { tipo: "ignorar" };
    return { tipo: "orc_defeito", aparelho: livre };
  }
  if (etapa === "orc_defeito") {
    const defeito = livre || (temMidia ? "(enviou foto/áudio)" : "");
    if (!defeito) return { tipo: "orc_defeito", aparelho: estado.dados.aparelho ?? "" };
    return { tipo: "orc_registrar", aparelho: estado.dados.aparelho ?? "", defeito };
  }

  // etapa "menu"
  if (opcao === 1) return { tipo: "status" };
  if (opcao === 2) return { tipo: "orc_aparelho" };
  if (opcao === 3) return { tipo: "garantia" };
  if (!livre) return { tipo: "ignorar" };
  const desdeResposta = agora.getTime() - new Date(estado.atualizadoEm ?? 0).getTime();
  if (desdeResposta < RAJADA_MS) return { tipo: "ignorar" };
  const erros = (estado.dados.erros ?? 0) + 1;
  if (erros >= 3) return { tipo: "atendente", motivo: "nao_entendeu" };
  return { tipo: "nao_entendeu", erros };
}

// ---------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------

export type Contexto = {
  loja: string;
  /** Primeiro nome do cliente, se conhecido. */
  nome: string | null;
  aberto: boolean;
  /** Ex.: "amanhã às 8h". */
  abre: string | null;
};

const MENU = [
  "1️⃣ Status da minha OS",
  "2️⃣ Orçamento / conserto",
  "3️⃣ Garantia",
  "4️⃣ Falar com um atendente",
].join("\n");

const RODAPE = "_Digite 0 para ver o menu ou 4 para falar com um atendente._";

function fechadoAgora(ctx: Contexto): string {
  return ctx.abre
    ? `No momento estamos fechados — voltamos ${ctx.abre}.`
    : "No momento estamos fechados.";
}

export function textoMenu(ctx: Contexto, saudacao: boolean): string {
  const partes: string[] = [];
  if (saudacao) {
    partes.push(
      `Olá${ctx.nome ? `, ${ctx.nome}` : ""}! 👋 Sou o assistente virtual da *${ctx.loja}*.`,
    );
    if (!ctx.aberto) partes.push(`${fechadoAgora(ctx)} Mas já posso te ajudar por aqui:`);
    else partes.push("Como posso te ajudar?");
  } else {
    partes.push("Como posso te ajudar?");
  }
  partes.push(MENU, "_Responda com o número da opção._");
  return partes.join("\n\n");
}

export function textoNaoEntendi(): string {
  return `Desculpe, não entendi. 😅 Responda só com o número:\n\n${MENU}`;
}

export type OsResumo = {
  numero: number;
  aparelho: string;
  status: string;
  /** Rótulo do status para o cliente (ex.: "Em reparo"). */
  statusLabel: string;
  previsao: string | null;
  /** Já formatado (R$), só para pronta/orçamento. */
  valor: string | null;
};

function dataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function textoStatus(lista: OsResumo[]): string {
  if (!lista.length) {
    return [
      "Não encontrei nenhuma ordem de serviço ligada a este número. 🤔",
      "Se o aparelho foi deixado com outro telefone, responda *4* que um atendente confere para você.",
      RODAPE,
    ].join("\n\n");
  }
  const linhas = lista.map((os) => {
    let linha = `🔧 *OS #${os.numero}* — ${os.aparelho}\nStatus: *${os.statusLabel}*`;
    if (os.status === "pronto") {
      linha = `✅ *OS #${os.numero}* — ${os.aparelho}\n*Pronta para retirada!*`;
      if (os.valor) linha += ` Valor: ${os.valor}`;
    } else if (os.status === "aguardando_aprovacao" && os.valor) {
      linha += `\nOrçamento: ${os.valor} — responda *4* para aprovar com um atendente.`;
    } else if (os.previsao) {
      linha += `\nPrevisão: ${dataBR(os.previsao)}`;
    }
    return linha;
  });
  return [
    lista.length === 1 ? "Encontrei sua ordem de serviço:" : "Encontrei estas ordens de serviço:",
    ...linhas,
    RODAPE,
  ].join("\n\n");
}

export type GarantiaResumo = { numero: number; aparelho: string; vence: string };

export function textoGarantia(lista: GarantiaResumo[]): string {
  if (!lista.length) {
    return [
      "Não encontrei garantia ativa ligada a este número.",
      "Se acha que tem uma garantia válida, responda *4* que um atendente verifica.",
      RODAPE,
    ].join("\n\n");
  }
  const linhas = lista.map(
    (g) => `🛡️ *OS #${g.numero}* — ${g.aparelho}\nGarantia até *${dataBR(g.vence)}*`,
  );
  return [
    "Garantias ativas neste número:",
    ...linhas,
    "Notou algum problema? Responda *4* para falar com um atendente.",
  ].join("\n\n");
}

export function textoPerguntaAparelho(): string {
  return "Certo! Qual é o aparelho? Me diga a marca e o modelo (ex.: _iPhone 11_, _Galaxy A32_).";
}

export function textoPerguntaDefeito(aparelho: string): string {
  return `Anotado: *${aparelho}*. 📱\nAgora me conta: o que está acontecendo com ele?`;
}

export function textoOrcamentoRegistrado(ctx: Contexto, aparelho: string, defeito: string): string {
  const quando = ctx.aberto
    ? "Um atendente vai te responder com o orçamento em breve."
    : `${fechadoAgora(ctx)} Um atendente te responde com o orçamento assim que abrirmos.`;
  return [
    "Pronto, pedido de orçamento anotado! 📝",
    `*Aparelho:* ${aparelho}\n*Problema:* ${defeito}`,
    quando,
  ].join("\n\n");
}

export function textoAtendente(ctx: Contexto, motivo: "pedido" | "nao_entendeu"): string {
  const inicio =
    motivo === "pedido"
      ? "Certo! Já avisei a equipe. 🙋"
      : "Vou chamar alguém da equipe para te ajudar. 🙋";
  const quando = ctx.aberto
    ? "Um atendente continua a conversa por aqui em instantes."
    : `${fechadoAgora(ctx)} Um atendente te responde assim que abrirmos.`;
  return `${inicio}\n${quando}`;
}

/** robo_pausado_ate da conversa: "infinity" = pausado até alguém religar. */
export function roboPausado(pausadoAte: string | null | undefined, agora: Date): boolean {
  if (!pausadoAte) return false;
  if (pausadoAte === "infinity") return true;
  const ate = new Date(pausadoAte).getTime();
  return Number.isFinite(ate) && ate > agora.getTime();
}

/** Primeiro nome para a saudação; contato com nome só de emoji/número fica sem nome. */
export function primeiroNome(nome: string | null | undefined): string | null {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/\p{L}{2,}/u.test(primeiro)) return null;
  const limpo = primeiro.replace(/[^\p{L}'-]/gu, "");
  return limpo ? limpo[0]!.toUpperCase() + limpo.slice(1).toLowerCase() : null;
}
