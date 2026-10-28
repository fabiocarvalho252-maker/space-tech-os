// Texto do lembrete diário ao técnico (Configurações → WhatsApp → "Equipe:
// lembrete de visita/entrega ao técnico"). Puro, sem banco nem imports "@/",
// para rodar no node --test; quem busca os dados e envia é
// lembrete-tecnico.server.ts.

export type OsDoDia = {
  numero: number;
  aparelho: string | null;
  cliente: string | null;
  status: string;
};
export type VisitaDoDia = { inicio: string; titulo: string; cliente: string | null };

/** "09:30" no horário de Brasília. */
function horaBrasilia(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_LEGIVEL: Record<string, string> = {
  pronto: "pronta para entregar",
  aguardando_peca: "aguardando peça",
  em_reparo: "em reparo",
  em_analise: "em análise",
  orcamento: "orçamento",
  aguardando_aprovacao: "aguardando aprovação",
  aprovado: "aprovada",
  recebido: "recebida",
};

export function montarLembreteTecnico(params: {
  texto: string;
  tecnico: string;
  loja: string;
  os: OsDoDia[];
  visitas: VisitaDoDia[];
}): string | null {
  if (!params.os.length && !params.visitas.length) return null;
  const primeiroNome = params.tecnico.trim().split(/\s+/)[0] ?? "";
  const cabecalho = params.texto
    .replace(/\{\{\s*tecnico\s*\}\}/g, primeiroNome)
    .replace(/\{\{\s*loja\s*\}\}/g, params.loja)
    .replace(/Olá\s+,/g, "Olá,");
  const linhas = [cabecalho];
  if (params.visitas.length) {
    linhas.push("", "📅 *Agenda de hoje*");
    for (const v of [...params.visitas].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
      linhas.push(`• ${horaBrasilia(v.inicio)} — ${v.titulo}${v.cliente ? ` (${v.cliente})` : ""}`);
    }
  }
  if (params.os.length) {
    linhas.push("", "🔧 *OS com entrega prevista para hoje*");
    for (const o of [...params.os].sort((a, b) => a.numero - b.numero)) {
      const status = STATUS_LEGIVEL[o.status] ?? o.status;
      linhas.push(
        `• OS #${o.numero}${o.aparelho ? ` — ${o.aparelho}` : ""}${o.cliente ? ` (${o.cliente})` : ""} · ${status}`,
      );
    }
  }
  return linhas.join("\n");
}
