import { lerHorario, resumoHorario, type Horario } from "./whatsapp/robo";

/**
 * Linha "Horário: Seg a Sex 8h–18h · Sáb 8h–12h" para comprovantes e PDFs, a
 * partir de profiles.horario_funcionamento. null quando a loja não informou.
 */
export function linhaHorarioLoja(valor: unknown): string | null {
  if (valor == null) return null;
  const resumo = resumoHorario(lerHorario(valor));
  return resumo ? `Horário: ${resumo}` : null;
}

/** Fechamento precisa vir depois da abertura em todo dia aberto. */
export function horarioInvalido(horario: Horario): boolean {
  return horario.some((d) => d && (!d.abre || !d.fecha || d.fecha <= d.abre));
}
