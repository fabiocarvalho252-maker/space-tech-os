// Telefone ↔ conversa. Sem imports com "@/": roda direto no `node --test`
// (scripts/test.sh).

/**
 * Chave da conversa: DDD + últimos 8 dígitos. O WhatsApp devolve
 * 557498125994 para quem está cadastrado como (74) 99812-5994 — com e sem
 * o 55 e o nono dígito, os dois dão a mesma chave. Mesma regra da função
 * SQL whatsapp_chave_telefone (migration 20261026100000).
 */
export function chaveTelefone(numero: string): string {
  let d = numero.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length >= 10 && d.length <= 11) return `${d.slice(0, 2)}${d.slice(-8)}`;
  return d;
}

/** Número no formato que a Evolution espera (DDI 55 para números brasileiros sem DDI). */
export function paraE164BR(numero: string): string {
  const d = numero.replace(/\D/g, "");
  return d.startsWith("55") && d.length > 11 ? d : `55${d}`;
}

/** (74) 99812-5994 para exibir; números de fora ficam com + e os dígitos. */
export function formatarTelefone(numero: string): string {
  let d = numero.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d ? `+${d}` : numero;
}
