// Quem pode usar o runner: o token do Supabase precisa ser válido e o e-mail
// precisa ser o do administrador do site. A checagem recebe o verificador como
// dependência para ser testada sem rede.

export type UsuarioVerificado = { id: string; email: string };
export type VerificarToken = (token: string) => Promise<UsuarioVerificado | null>;

export class AcessoNegado extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

export function extrairBearer(cabecalho: string | undefined): string {
  const partes = cabecalho?.split(" ") ?? [];
  if (partes.length !== 2 || partes[0] !== "Bearer" || !partes[1]) {
    throw new AcessoNegado(401, "Faça login para continuar.");
  }
  return partes[1];
}

export async function exigirAdmin(
  cabecalho: string | undefined,
  emailAdmin: string,
  verificar: VerificarToken,
): Promise<UsuarioVerificado> {
  const token = extrairBearer(cabecalho);
  const usuario = await verificar(token);
  if (!usuario) throw new AcessoNegado(401, "Sessão inválida ou expirada.");
  if (usuario.email !== emailAdmin) throw new AcessoNegado(403, "Acesso restrito ao administrador do site.");
  return usuario;
}
