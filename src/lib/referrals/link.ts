// Client-safe helpers shared between /cadastro (attribution capture) and
// the future /indicacoes panel (Fase B, "Meu link"). Kept separate from
// referral.functions.ts (server-only) so this can be imported from plain
// client components without pulling in supabaseAdmin.
import { origemPublica } from "@/lib/site-url";

const STORAGE_KEY = "space-tech-referral-code";
// Technical default for how long an attribution survives without a
// completed signup — not a business/commission value, so it isn't subject
// to the "never invent a value" rule that applies to money.
const VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;

export function getReferralLink(referralCode: string): string {
  return `${origemPublica()}/cadastro?ref=${encodeURIComponent(referralCode)}`;
}

/** Always keeps the most recently seen code (Fase 10: "last valid
 * referral wins") — called every time /cadastro loads with a ?ref= param,
 * so a newer link always overwrites an older captured attribution. */
export function salvarCodigoIndicacao(codigo: string): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ codigo: codigo.trim().toUpperCase(), capturadoEm: Date.now() }),
    );
  } catch {
    // localStorage indisponível (modo privado etc.) — a atribuição por
    // querystring direta na hora do cadastro ainda funciona sem isso.
  }
}

export function lerCodigoIndicacaoSalvo(): string | null {
  try {
    const bruto = window.localStorage.getItem(STORAGE_KEY);
    if (!bruto) return null;
    const { codigo, capturadoEm } = JSON.parse(bruto);
    if (typeof codigo !== "string" || typeof capturadoEm !== "number") return null;
    if (Date.now() - capturadoEm > VALIDADE_MS) return null;
    return codigo;
  } catch {
    return null;
  }
}

export function limparCodigoIndicacaoSalvo(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
