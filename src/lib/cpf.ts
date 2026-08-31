// Validação/máscara de CPF para o vendedor na Compra de Seminovos (pedido
// do usuário) — mesmo algoritmo (dígitos verificadores) implementado em SQL
// na função public.validar_cpf() (ver migration
// 20260901120000_seminovos_cpf_assinatura.sql), para dar feedback imediato
// no formulário sem esperar o round-trip ao banco. O banco continua sendo a
// validação que realmente impede um CPF inválido de ser salvo.

export function limparCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function formatarCpf(valor: string): string {
  const digitos = limparCpf(valor).slice(0, 11);
  return digitos
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function mascararCpf(valor: string | null | undefined): string {
  const digitos = limparCpf(valor ?? "");
  if (digitos.length !== 11) return valor || "—";
  return `***.***.***-${digitos.slice(9)}`;
}

export function validarCpf(valor: string): boolean {
  const cpf = limparCpf(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto >= 10) resto = 0;
  if (resto !== Number(cpf[9])) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto >= 10) resto = 0;
  if (resto !== Number(cpf[10])) return false;

  return true;
}
