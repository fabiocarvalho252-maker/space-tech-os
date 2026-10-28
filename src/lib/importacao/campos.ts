// Definição dos tipos de importação (tela /importar): campos do SPACE TECH,
// nomes de coluna que costumam aparecer em planilhas de outros sistemas
// (para ligar as colunas sozinho) e a limpeza de cada valor. Usado no
// navegador (prévia) e no servidor (importacao.functions.ts), que refaz a
// limpeza em vez de confiar no que veio da tela.
import { formatarDocumento, somenteDigitos, validarCnpj, validarCpf } from "@/lib/documento";
import { maskPhoneBR } from "@/lib/whatsapp";

export type TipoImportacao = "clientes" | "fornecedores" | "produtos" | "servicos";

type TipoValor = "texto" | "telefone" | "documento" | "email" | "dinheiro" | "inteiro" | "data";

export type CampoImportacao = {
  chave: string;
  rotulo: string;
  tipo: TipoValor;
  obrigatorio?: boolean;
  /** Nomes de coluna reconhecidos, já sem acento/maiúscula/pontuação. */
  sinonimos: string[];
};

// Partes de endereço que muitos sistemas exportam em colunas separadas;
// viram um texto só no campo endereco.
const CAMPOS_ENDERECO: CampoImportacao[] = [
  {
    chave: "endereco",
    rotulo: "Endereço (completo ou rua)",
    tipo: "texto",
    sinonimos: ["endereco", "logradouro", "rua", "enderecocompleto", "address"],
  },
  { chave: "numero", rotulo: "Número", tipo: "texto", sinonimos: ["numero", "num", "n", "nro"] },
  {
    chave: "complemento",
    rotulo: "Complemento",
    tipo: "texto",
    sinonimos: ["complemento", "compl"],
  },
  { chave: "bairro", rotulo: "Bairro", tipo: "texto", sinonimos: ["bairro"] },
  {
    chave: "cidade",
    rotulo: "Cidade",
    tipo: "texto",
    sinonimos: ["cidade", "municipio", "city"],
  },
  { chave: "uf", rotulo: "UF", tipo: "texto", sinonimos: ["uf", "estado", "state"] },
  { chave: "cep", rotulo: "CEP", tipo: "texto", sinonimos: ["cep", "codigopostal", "zip"] },
];

export const TIPOS_IMPORTACAO: Record<
  TipoImportacao,
  { rotulo: string; descricao: string; modulo: string; campos: CampoImportacao[] }
> = {
  clientes: {
    rotulo: "Clientes",
    descricao: "Nome, telefone, CPF/CNPJ, e-mail, endereço e observações.",
    modulo: "clientes",
    campos: [
      {
        chave: "nome",
        rotulo: "Nome",
        tipo: "texto",
        obrigatorio: true,
        sinonimos: ["nome", "cliente", "nomecliente", "nomecompleto", "razaosocial", "name"],
      },
      {
        chave: "telefone",
        rotulo: "Telefone / WhatsApp",
        tipo: "telefone",
        sinonimos: [
          "telefone",
          "celular",
          "whatsapp",
          "fone",
          "tel",
          "telefone1",
          "contato",
          "phone",
          "telefonecelular",
        ],
      },
      {
        chave: "documento",
        rotulo: "CPF / CNPJ",
        tipo: "documento",
        sinonimos: ["cpf", "cnpj", "cpfcnpj", "documento", "doc", "cpfoucnpj"],
      },
      {
        chave: "email",
        rotulo: "E-mail",
        tipo: "email",
        sinonimos: ["email", "e-mail", "mail"],
      },
      ...CAMPOS_ENDERECO,
      {
        chave: "data_nascimento",
        rotulo: "Data de nascimento",
        tipo: "data",
        sinonimos: ["nascimento", "datanascimento", "datadenascimento", "aniversario", "dtnasc"],
      },
      {
        chave: "observacoes",
        rotulo: "Observações",
        tipo: "texto",
        sinonimos: ["observacoes", "observacao", "obs", "anotacoes", "notas"],
      },
    ],
  },
  fornecedores: {
    rotulo: "Fornecedores",
    descricao: "Razão social, nome fantasia, CNPJ/CPF, contatos e endereço.",
    modulo: "fornecedores",
    campos: [
      {
        chave: "razao_social",
        rotulo: "Razão social / Nome",
        tipo: "texto",
        obrigatorio: true,
        sinonimos: ["razaosocial", "nome", "fornecedor", "empresa", "nomefornecedor"],
      },
      {
        chave: "nome_fantasia",
        rotulo: "Nome fantasia",
        tipo: "texto",
        sinonimos: ["nomefantasia", "fantasia", "apelido"],
      },
      {
        chave: "cnpj_cpf",
        rotulo: "CNPJ / CPF",
        tipo: "documento",
        sinonimos: ["cnpj", "cpf", "cnpjcpf", "cpfcnpj", "documento"],
      },
      {
        chave: "telefone",
        rotulo: "Telefone",
        tipo: "telefone",
        sinonimos: ["telefone", "fone", "tel", "telefone1"],
      },
      {
        chave: "whatsapp",
        rotulo: "WhatsApp",
        tipo: "telefone",
        sinonimos: ["whatsapp", "celular", "zap"],
      },
      {
        chave: "email",
        rotulo: "E-mail",
        tipo: "email",
        sinonimos: ["email", "e-mail", "mail"],
      },
      ...CAMPOS_ENDERECO,
      {
        chave: "observacoes",
        rotulo: "Observações",
        tipo: "texto",
        sinonimos: ["observacoes", "observacao", "obs"],
      },
    ],
  },
  produtos: {
    rotulo: "Produtos e estoque",
    descricao: "Nome, código, categoria, custo, preço de venda e quantidade em estoque.",
    modulo: "produtos",
    campos: [
      {
        chave: "nome",
        rotulo: "Nome do produto",
        tipo: "texto",
        obrigatorio: true,
        sinonimos: ["nome", "produto", "descricao", "nomeproduto", "item", "descricaoproduto"],
      },
      {
        chave: "sku",
        rotulo: "Código / SKU",
        tipo: "texto",
        sinonimos: ["sku", "codigo", "cod", "codigointerno", "referencia", "ref"],
      },
      {
        chave: "codigo_barras",
        rotulo: "Código de barras",
        tipo: "texto",
        sinonimos: ["codigodebarras", "codigobarras", "ean", "gtin", "barras", "codbarras"],
      },
      {
        chave: "categoria",
        rotulo: "Categoria",
        tipo: "texto",
        sinonimos: ["categoria", "grupo", "departamento", "tipo", "familia"],
      },
      {
        chave: "preco_custo",
        rotulo: "Preço de custo",
        tipo: "dinheiro",
        sinonimos: ["custo", "precocusto", "precodecusto", "valorcusto", "vlrcusto", "compra"],
      },
      {
        chave: "preco_venda",
        rotulo: "Preço de venda",
        tipo: "dinheiro",
        sinonimos: [
          "preco",
          "precovenda",
          "precodevenda",
          "valor",
          "valorvenda",
          "vlrvenda",
          "venda",
        ],
      },
      {
        chave: "quantidade",
        rotulo: "Quantidade em estoque",
        tipo: "inteiro",
        sinonimos: ["quantidade", "qtd", "qtde", "estoque", "saldo", "estoqueatual", "qtdestoque"],
      },
      {
        chave: "estoque_minimo",
        rotulo: "Estoque mínimo",
        tipo: "inteiro",
        sinonimos: ["estoqueminimo", "minimo", "qtdminima", "estmin"],
      },
      {
        chave: "marca",
        rotulo: "Marca",
        tipo: "texto",
        sinonimos: ["marca", "fabricante", "brand"],
      },
      {
        chave: "localizacao",
        rotulo: "Localização",
        tipo: "texto",
        sinonimos: ["localizacao", "local", "prateleira", "gaveta", "posicao"],
      },
      {
        chave: "fornecedor",
        rotulo: "Fornecedor (nome)",
        tipo: "texto",
        sinonimos: ["fornecedor", "nomefornecedor"],
      },
      {
        chave: "descricao",
        rotulo: "Descrição / observação",
        tipo: "texto",
        sinonimos: [
          "observacoes",
          "observacao",
          "obs",
          "detalhes",
          "descricaocompleta",
          "descricao",
        ],
      },
    ],
  },
  servicos: {
    rotulo: "Serviços",
    descricao: "Nome do serviço, preço cobrado, custo e descrição.",
    modulo: "produtos",
    campos: [
      {
        chave: "nome",
        rotulo: "Nome do serviço",
        tipo: "texto",
        obrigatorio: true,
        sinonimos: ["nome", "servico", "descricao", "nomeservico"],
      },
      {
        chave: "preco_venda",
        rotulo: "Preço cobrado",
        tipo: "dinheiro",
        sinonimos: ["preco", "valor", "precovenda", "valorservico", "maodeobra"],
      },
      {
        chave: "preco_custo",
        rotulo: "Custo",
        tipo: "dinheiro",
        sinonimos: ["custo", "precocusto", "valorcusto"],
      },
      {
        chave: "descricao",
        rotulo: "Descrição / observação",
        tipo: "texto",
        sinonimos: ["observacoes", "observacao", "obs", "detalhes", "descricao"],
      },
    ],
  },
};

export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Liga cada campo à primeira coluna da planilha com nome conhecido. */
export function mapearColunas(tipo: TipoImportacao, colunas: string[]): Record<string, number> {
  const normalizadas = colunas.map(normalizarCabecalho);
  const mapa: Record<string, number> = {};
  const usadas = new Set<number>();
  // 1ª passada: nome exato. 2ª: a coluna contém o sinônimo ("Nome do
  // Cliente", "Dt. Nascimento") — só sinônimos de 4+ letras, para "uf" ou
  // "n" não pegarem qualquer coluna.
  const passadas: ((coluna: string, sinonimo: string) => boolean)[] = [
    (c, s) => c === s,
    (c, s) => s.length >= 4 && c.includes(s),
  ];
  for (const bate of passadas) {
    for (const campo of TIPOS_IMPORTACAO[tipo].campos) {
      if (mapa[campo.chave] !== undefined) continue;
      // Sinônimo mais específico primeiro: "descricao" só vira nome do
      // produto se não houver uma coluna "produto"/"nome".
      for (const sinonimo of campo.sinonimos) {
        const i = normalizadas.findIndex((c, idx) => !usadas.has(idx) && bate(c, sinonimo));
        if (i >= 0) {
          mapa[campo.chave] = i;
          usadas.add(i);
          break;
        }
      }
    }
  }
  return mapa;
}

export type ValorBruto = string | number | boolean | null;

function texto(v: ValorBruto): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

export function lerDinheiro(v: ValorBruto): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = texto(v).replace(/[R$\s]/g, "");
  if (!s) return null;
  // "1.234,56" (BR) ou "1234.56" / "1,234.56" (exportação em inglês)
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function lerInteiro(v: ValorBruto): number | null {
  const n = lerDinheiro(v);
  return n === null ? null : Math.round(n);
}

function lerData(v: ValorBruto): string | null {
  const s = texto(v);
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const ano = m[3]!.length === 2 ? (Number(m[3]) > 30 ? `19${m[3]}` : `20${m[3]}`) : m[3]!;
  const mes = m[2]!.padStart(2, "0");
  const dia = m[1]!.padStart(2, "0");
  const d = new Date(`${ano}-${mes}-${dia}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.getUTCMonth() + 1 !== Number(mes)
    ? null
    : `${ano}-${mes}-${dia}`;
}

function lerTelefone(v: ValorBruto): { valor: string | null; aviso?: string } {
  const bruto = texto(v);
  if (!bruto) return { valor: null };
  let d = somenteDigitos(bruto);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11 && d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) return { valor: maskPhoneBR(d) };
  return { valor: bruto.slice(0, 40), aviso: `telefone fora do padrão (${bruto})` };
}

function lerDocumento(v: ValorBruto): { valor: string | null; aviso?: string } {
  const d = somenteDigitos(texto(v));
  if (!d) return { valor: null };
  // Excel costuma comer o zero da frente de CPF guardado como número.
  const cheio = d.length === 10 ? `0${d}` : d.length === 13 ? `0${d}` : d;
  if (cheio.length === 11) {
    return validarCpf(cheio)
      ? { valor: formatarDocumento(cheio) }
      : { valor: formatarDocumento(cheio), aviso: "CPF inválido" };
  }
  if (cheio.length === 14) {
    return validarCnpj(cheio)
      ? { valor: formatarDocumento(cheio) }
      : { valor: formatarDocumento(cheio), aviso: "CNPJ inválido" };
  }
  return { valor: texto(v).slice(0, 30), aviso: "CPF/CNPJ incompleto" };
}

function montarEndereco(c: Record<string, string>): string | null {
  const rua = [c["endereco"], c["numero"]].filter(Boolean).join(", ");
  const partes = [
    [rua, c["complemento"]].filter(Boolean).join(" - "),
    c["bairro"],
    [c["cidade"], c["uf"]?.toUpperCase()].filter(Boolean).join("/"),
    c["cep"] ? `CEP ${c["cep"]}` : "",
  ].filter(Boolean);
  return partes.length ? partes.join(" - ").slice(0, 500) : null;
}

export type LinhaLimpa = {
  /** Valores prontos para gravar (colunas da tabela). */
  dados: Record<string, string | number | null>;
  /** Linha não pode ser importada. */
  erro?: string;
  /** Importa, mas vale conferir. */
  avisos: string[];
};

/** Limpa uma linha já ligada aos campos (chave do campo → valor da planilha). */
export function limparLinha(tipo: TipoImportacao, bruta: Record<string, ValorBruto>): LinhaLimpa {
  const avisos: string[] = [];
  const valores: Record<string, string> = {};
  const dados: Record<string, string | number | null> = {};

  for (const campo of TIPOS_IMPORTACAO[tipo].campos) {
    const v = bruta[campo.chave] ?? null;
    switch (campo.tipo) {
      case "telefone": {
        const r = lerTelefone(v);
        if (r.aviso) avisos.push(r.aviso);
        dados[campo.chave] = r.valor;
        break;
      }
      case "documento": {
        const r = lerDocumento(v);
        if (r.aviso) avisos.push(r.aviso);
        dados[campo.chave] = r.valor;
        break;
      }
      case "email": {
        const s = texto(v).toLowerCase();
        if (s && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) avisos.push(`e-mail inválido (${s})`);
        dados[campo.chave] = s ? s.slice(0, 200) : null;
        break;
      }
      case "dinheiro": {
        const n = lerDinheiro(v);
        if (n === null && texto(v)) avisos.push(`valor não entendido em ${campo.rotulo}`);
        if (n !== null && n < 0) avisos.push(`${campo.rotulo} negativo`);
        dados[campo.chave] = n;
        break;
      }
      case "inteiro": {
        const n = lerInteiro(v);
        if (n === null && texto(v)) avisos.push(`número não entendido em ${campo.rotulo}`);
        dados[campo.chave] = n;
        break;
      }
      case "data": {
        const d = lerData(v);
        if (!d && texto(v)) avisos.push(`data não entendida (${texto(v)})`);
        dados[campo.chave] = d;
        break;
      }
      default: {
        const s = texto(v);
        valores[campo.chave] = s;
        dados[campo.chave] = s ? s.slice(0, 500) : null;
      }
    }
  }

  // Campos de endereço separados viram um só.
  if ("endereco" in dados) {
    dados["endereco"] = montarEndereco(valores);
    for (const k of ["numero", "complemento", "bairro", "cidade", "uf", "cep"]) delete dados[k];
  }

  const obrigatorio = TIPOS_IMPORTACAO[tipo].campos.find((c) => c.obrigatorio)!;
  if (!dados[obrigatorio.chave]) {
    return { dados, erro: `${obrigatorio.rotulo} em branco`, avisos };
  }
  return { dados, avisos };
}

/** Chave para achar duplicados (na planilha e no que já está cadastrado). */
export function chaveDuplicado(
  tipo: TipoImportacao,
  d: Record<string, string | number | null>,
): string {
  const dig = (v: unknown) => somenteDigitos(typeof v === "string" ? v : "");
  const nome = (v: unknown) => normalizarCabecalho(typeof v === "string" ? v : "");
  switch (tipo) {
    case "clientes": {
      const doc = dig(d["documento"]);
      if (doc.length >= 11) return `doc:${doc}`;
      const tel = dig(d["telefone"]);
      if (tel.length >= 10) return `tel:${tel}`;
      return `nome:${nome(d["nome"])}`;
    }
    case "fornecedores": {
      const doc = dig(d["cnpj_cpf"]);
      return doc.length >= 11 ? `doc:${doc}` : `nome:${nome(d["razao_social"])}`;
    }
    case "produtos": {
      const barras = typeof d["codigo_barras"] === "string" ? d["codigo_barras"].trim() : "";
      if (barras) return `ean:${barras}`;
      const sku = typeof d["sku"] === "string" ? d["sku"].trim().toLowerCase() : "";
      if (sku) return `sku:${sku}`;
      return `nome:${nome(d["nome"])}`;
    }
    case "servicos":
      return `nome:${nome(d["nome"])}`;
  }
}
