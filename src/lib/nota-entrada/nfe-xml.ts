// Leitura de XML de NF-e (nota de compra do fornecedor).
// Recebe um Document já parseado (DOMParser no navegador) e devolve os
// dados que a tela precisa para lançar a nota no estoque.

export type ItemNota = {
  numero: number;
  codigo: string;
  ean: string | null;
  descricao: string;
  ncm: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
  valorTotal: number;
};

export type NotaEntrada = {
  chave: string | null;
  numero: string;
  serie: string;
  dataEmissao: string | null;
  emitente: { cnpj: string; nome: string };
  itens: ItemNota[];
  valorTotal: number;
};

const CHAVE_NFE_TAMANHO = 44;
const EAN_SEM_GTIN = "SEM GTIN";

function texto(pai: Element, tag: string): string {
  return pai.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

function numero(pai: Element, tag: string): number {
  const valor = Number(texto(pai, tag));
  return Number.isFinite(valor) ? valor : 0;
}

/** EAN/GTIN válido precisa ter só dígitos e 8, 12, 13 ou 14 posições. */
export function eanValido(codigo: string): boolean {
  return /^\d+$/.test(codigo) && [8, 12, 13, 14].includes(codigo.length);
}

function lerEan(prod: Element): string | null {
  const ean = texto(prod, "cEAN");
  if (!ean || ean.toUpperCase() === EAN_SEM_GTIN) return null;
  return eanValido(ean) ? ean : null;
}

function lerItem(det: Element): ItemNota {
  const prod = det.getElementsByTagName("prod")[0];
  if (!prod) throw new Error(`Item ${det.getAttribute("nItem") ?? "?"} sem dados de produto.`);
  return {
    numero: Number(det.getAttribute("nItem")) || 0,
    codigo: texto(prod, "cProd"),
    ean: lerEan(prod),
    descricao: texto(prod, "xProd"),
    ncm: texto(prod, "NCM"),
    unidade: texto(prod, "uCom"),
    quantidade: numero(prod, "qCom"),
    custoUnitario: numero(prod, "vUnCom"),
    valorTotal: numero(prod, "vProd"),
  };
}

function lerChave(doc: Document): string | null {
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  const id = infNFe?.getAttribute("Id") ?? "";
  const chave = id.replace(/^NFe/, "");
  return chave.length === CHAVE_NFE_TAMANHO && /^\d+$/.test(chave) ? chave : null;
}

/** Extrai a nota de um Document de NF-e. Lança erro com mensagem clara se não for NF-e. */
export function extrairNotaEntrada(doc: Document): NotaEntrada {
  const infNFe = doc.getElementsByTagName("infNFe")[0];
  if (!infNFe) throw new Error("Arquivo não é uma NF-e (XML sem o bloco infNFe).");

  const ide = infNFe.getElementsByTagName("ide")[0];
  const emit = infNFe.getElementsByTagName("emit")[0];
  const total = infNFe.getElementsByTagName("ICMSTot")[0];
  if (!ide || !emit) throw new Error("NF-e incompleta: faltam os dados de identificação ou do emitente.");

  const dets = Array.from(infNFe.getElementsByTagName("det"));
  if (!dets.length) throw new Error("NF-e sem itens.");

  return {
    chave: lerChave(doc),
    numero: texto(ide, "nNF"),
    serie: texto(ide, "serie"),
    dataEmissao: texto(ide, "dhEmi") || texto(ide, "dEmi") || null,
    emitente: { cnpj: texto(emit, "CNPJ") || texto(emit, "CPF"), nome: texto(emit, "xNome") },
    itens: dets.map(lerItem),
    valorTotal: total ? numero(total, "vNF") : 0,
  };
}

/** Converte o texto do arquivo em Document (só no navegador). */
export function lerXmlNota(conteudo: string): NotaEntrada {
  const doc = new DOMParser().parseFromString(conteudo, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Não foi possível ler o XML. Confira se o arquivo é o XML original da nota.");
  }
  return extrairNotaEntrada(doc);
}
