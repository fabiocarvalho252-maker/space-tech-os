// Consultas usadas no cadastro de clientes: CPF/CNPJ (validação + dados
// públicos de empresa) e CEP. Só serviços gratuitos e públicos — não existe
// fonte gratuita que devolva dados pessoais a partir de um CPF, então para
// CPF o sistema apenas valida o número e procura duplicidade na própria base.
import { formatarCpf, validarCpf } from "@/lib/cpf";

export function somenteDigitos(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

export function validarCnpj(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const digito = (base: string) => {
    let peso = base.length - 7;
    let soma = 0;
    for (const n of base) {
      soma += Number(n) * peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = digito(cnpj.slice(0, 12));
  const d2 = digito(cnpj.slice(0, 12) + d1);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

export function formatarCnpj(valor: string): string {
  return somenteDigitos(valor)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** Máscara de CPF até 11 dígitos; acima disso, de CNPJ. */
export function formatarDocumento(valor: string): string {
  const digitos = somenteDigitos(valor);
  return digitos.length <= 11 ? formatarCpf(digitos) : formatarCnpj(digitos);
}

export { validarCpf };

export function formatarCep(valor: string): string {
  return somenteDigitos(valor)
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

function formatarTelefone(digitos: string): string {
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return digitos;
}

function juntar(partes: (string | null | undefined)[], separador = ", "): string {
  return partes
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(separador);
}

export type DadosCnpj = {
  nome: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string;
  email: string;
  endereco: string;
  situacao: string;
};

// BrasilAPI espelha a base pública de CNPJ da Receita Federal (gratuita, com
// CORS liberado, então pode ser chamada direto do navegador).
export async function buscarCnpj(cnpj: string): Promise<DadosCnpj> {
  const digitos = somenteDigitos(cnpj);
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
  if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal.");
  if (!res.ok) throw new Error("Não foi possível consultar o CNPJ agora. Tente novamente.");
  const d = await res.json();

  const cidadeUf = juntar([d.municipio, d.uf], " - ");
  const cep = d.cep ? `CEP ${formatarCep(d.cep)}` : "";
  return {
    // Razão social identifica a empresa; o fantasia sozinho às vezes é só o
    // rótulo da filial (ex.: "DIRECAO GERAL").
    nome:
      d.nome_fantasia && d.nome_fantasia !== d.razao_social
        ? `${d.razao_social} (${d.nome_fantasia})`
        : d.razao_social || d.nome_fantasia || "",
    razaoSocial: d.razao_social ?? "",
    nomeFantasia: d.nome_fantasia ?? "",
    telefone: formatarTelefone(somenteDigitos(d.ddd_telefone_1)),
    email: (d.email ?? "").toLowerCase(),
    endereco: juntar([
      juntar([d.descricao_tipo_de_logradouro, d.logradouro], " "),
      d.numero,
      d.complemento,
      d.bairro,
      cidadeUf,
      cep,
    ]),
    situacao: d.descricao_situacao_cadastral ?? "",
  };
}

export type DadosCep = { logradouro: string; bairro: string; cidade: string; uf: string };

export async function buscarCepDetalhado(cep: string): Promise<DadosCep> {
  const digitos = somenteDigitos(cep);
  const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
  if (!res.ok) throw new Error("Não foi possível consultar o CEP agora. Tente novamente.");
  const d = await res.json();
  if (d.erro) throw new Error("CEP não encontrado.");
  return {
    logradouro: d.logradouro ?? "",
    bairro: d.bairro ?? "",
    cidade: d.localidade ?? "",
    uf: d.uf ?? "",
  };
}

export async function buscarCep(cep: string): Promise<string> {
  const d = await buscarCepDetalhado(cep);
  return juntar([
    d.logradouro,
    d.bairro,
    juntar([d.cidade, d.uf], " - "),
    `CEP ${formatarCep(cep)}`,
  ]);
}
