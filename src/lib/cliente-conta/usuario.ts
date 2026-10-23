// Área do Cliente logins created by staff from a Ordem de Serviço use a
// short username ("joao.silva") instead of an e-mail, since most customers
// at the counter don't have (or don't remember) one. Supabase Auth still
// needs an e-mail per account, so the username maps to an internal address
// on this domain — never a real mailbox, nothing is ever sent to it.
export const DOMINIO_USUARIO_CLIENTE = "clientes.spacetech.app";

export function emailDoUsuario(usuario: string): string {
  return `${usuario.trim().toLowerCase()}@${DOMINIO_USUARIO_CLIENTE}`;
}

// What the customer types on /login: either a real e-mail (self-signup
// accounts) or a username generated here.
export function emailDeLogin(valor: string): string {
  const v = valor.trim();
  return v.includes("@") ? v : emailDoUsuario(v);
}

export function usuarioDoEmail(email: string): string | null {
  const sufixo = `@${DOMINIO_USUARIO_CLIENTE}`;
  return email.toLowerCase().endsWith(sufixo) ? email.slice(0, -sufixo.length) : null;
}

const CONECTIVOS = new Set(["da", "de", "do", "das", "dos", "e"]);

// "João da Silva Souza" → "joao.souza"; single name → "joao".
export function usuarioBaseDoNome(nome: string): string {
  const partes = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !CONECTIVOS.has(p));
  if (partes.length === 0) return "cliente";
  const base = partes.length === 1 ? partes[0]! : `${partes[0]}.${partes[partes.length - 1]}`;
  return base.slice(0, 30);
}

// No 0/O/1/l/I — the password is read off a WhatsApp message and typed by hand.
const ALFABETO_SENHA = "abcdefghjkmnpqrstuvwxyz23456789";

export function gerarSenhaCliente(tamanho = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(tamanho));
  return Array.from(bytes, (b) => ALFABETO_SENHA[b % ALFABETO_SENHA.length]!).join("");
}
