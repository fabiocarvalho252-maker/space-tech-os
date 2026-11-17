// Ticket de uso único para abrir o WebSocket. O JWT nunca vai na URL.
import { randomBytes } from "node:crypto";

export const VALIDADE_TICKET_MS = 30_000;

export type Ticket = { valor: string; expiraEm: number };

export function criarGerenciadorTickets(agora: () => number = Date.now) {
  const pendentes = new Map<string, { usuarioId: string; expiraEm: number }>();

  function limparExpirados(): void {
    const momento = agora();
    for (const [valor, ticket] of pendentes) {
      if (ticket.expiraEm <= momento) pendentes.delete(valor);
    }
  }

  return {
    emitir(usuarioId: string): Ticket {
      limparExpirados();
      const valor = randomBytes(32).toString("hex");
      const expiraEm = agora() + VALIDADE_TICKET_MS;
      pendentes.set(valor, { usuarioId, expiraEm });
      return { valor, expiraEm };
    },
    // Consome o ticket: vale uma única vez e só dentro da validade.
    consumir(valor: string): string | null {
      const ticket = pendentes.get(valor);
      pendentes.delete(valor);
      if (!ticket || ticket.expiraEm <= agora()) return null;
      return ticket.usuarioId;
    },
  };
}
