// Lets the site admin (/admin, "Entrar no painel") temporarily hold a
// company's Supabase session in this browser tab while keeping a way back
// to their own admin session — sessionStorage instead of localStorage so it
// never leaks into a different tab and disappears automatically once this
// tab closes.
const CHAVE = "spacetech-impersonacao";

export type SessaoImpersonacao = {
  adminAccessToken: string;
  adminRefreshToken: string;
  empresaNome: string;
};

export function salvarImpersonacao(sessao: SessaoImpersonacao) {
  sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function obterImpersonacao(): SessaoImpersonacao | null {
  if (typeof window === "undefined") return null;
  const bruto = sessionStorage.getItem(CHAVE);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as SessaoImpersonacao;
  } catch {
    return null;
  }
}

export function limparImpersonacao() {
  sessionStorage.removeItem(CHAVE);
}
