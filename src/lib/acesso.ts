// Prazo de acesso de uma empresa (plano + acesso_ate + data de cadastro).
// Usado pelo bloqueio em routes/_authenticated/route.tsx, pelo aviso de dias
// restantes do próprio cliente (useStatusTrial) e pelo painel /admin — um só
// lugar para as três telas nunca discordarem.
import { differenceInCalendarDays } from "date-fns";

export const DIAS_TESTE = 7;
export const PLANOS_COM_VALIDADE = ["mensal", "anual"];

const DIA_MS = 86_400_000;

// profiles.acesso_ate é uma coluna `date` ("2026-10-08"). `new Date()` lê
// esse formato como meia-noite UTC — 21h do dia anterior no Brasil — o que
// bloqueava a empresa um dia antes do vencimento. Aqui vira meia-noite local.
export function parseDataLocal(data: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00`) : new Date(data);
}

export type PrazoAcesso =
  | { tipo: "suspenso" }
  | { tipo: "sem_vencimento" }
  | {
      tipo: "teste" | "pago";
      /** Primeiro instante SEM acesso. */
      fim: Date;
      /** Dias de calendário até o último dia de acesso (0 = último dia hoje; negativo = vencido). */
      diasRestantes: number;
      expirado: boolean;
    };

export function prazoAcesso(
  e: {
    plano: string | null | undefined;
    acessoAte: string | null | undefined;
    criadoEm: string | null | undefined;
  },
  agora = new Date(),
): PrazoAcesso {
  const plano = e.plano ?? "trial";
  if (plano === "suspenso") return { tipo: "suspenso" };
  if (plano === "vitalicio") return { tipo: "sem_vencimento" };

  if (PLANOS_COM_VALIDADE.includes(plano)) {
    if (!e.acessoAte) return { tipo: "sem_vencimento" };
    const ultimoDia = parseDataLocal(e.acessoAte);
    const fim = new Date(ultimoDia);
    fim.setDate(fim.getDate() + 1);
    const diasRestantes = differenceInCalendarDays(ultimoDia, agora);
    return { tipo: "pago", fim, diasRestantes, expirado: diasRestantes < 0 };
  }

  // Teste grátis: bloqueia quando passam mais de DIAS_TESTE dias completos
  // desde o cadastro — mesma regra que o bloqueio sempre usou.
  if (!e.criadoEm) {
    return {
      tipo: "teste",
      fim: new Date(agora.getTime() + (DIAS_TESTE + 1) * DIA_MS),
      diasRestantes: DIAS_TESTE,
      expirado: false,
    };
  }
  const fim = new Date(new Date(e.criadoEm).getTime() + (DIAS_TESTE + 1) * DIA_MS);
  const expirado = agora >= fim;
  // Com expirado, 0 = "Venceu hoje" (ver textoPrazo).
  const diasRestantes = differenceInCalendarDays(new Date(fim.getTime() - 1), agora);
  return { tipo: "teste", fim, diasRestantes, expirado };
}

/** "Faltam 5 dias", "Último dia", "Venceu há 3 dias"… */
export function textoPrazo(p: PrazoAcesso, agora = new Date()): string {
  if (p.tipo === "suspenso") return "Suspensa";
  if (p.tipo === "sem_vencimento") return "Sem vencimento";
  if (p.expirado) {
    const dias = Math.abs(p.diasRestantes);
    return dias <= 0 ? "Venceu hoje" : `Venceu há ${dias} dia${dias === 1 ? "" : "s"}`;
  }
  if (p.tipo === "teste") {
    const horas = Math.ceil((p.fim.getTime() - agora.getTime()) / 3_600_000);
    if (horas <= 24) return `Termina em ${horas}h`;
  }
  if (p.diasRestantes === 0) return "Último dia";
  return `Falta${p.diasRestantes === 1 ? "" : "m"} ${p.diasRestantes} dia${p.diasRestantes === 1 ? "" : "s"}`;
}
