// Planilha Excel (.xlsx) a partir das mesmas linhas usadas no CSV.
// Gera o XML do Office Open XML à mão e zipa com o jszip (já dependência do
// projeto, carregado só quando alguém exporta). Cabeçalho em negrito,
// primeira linha congelada, filtro nas colunas e largura ajustada ao conteúdo.
// As partes puras (montarArquivosXlsx) são testadas em tests/excel.test.ts.

export type LinhaPlanilha = Record<string, unknown>;

/** "custo_pecas" → "Custo pecas"; chaves já escritas ("Lançado em") ficam como estão. */
export function tituloColuna(chave: string): string {
  const t = chave.replace(/_/g, " ").trim();
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}

// Valores de dinheiro chegam como string de toFixed(2) ("123.45"): viram
// número para o Excel somar. Outros textos (OS "0012", telefone) não mudam.
const DINHEIRO = /^-?\d+\.\d{2}$/;

type Celula =
  | { tipo: "numero"; valor: number; dinheiro: boolean }
  | { tipo: "texto"; valor: string }
  | { tipo: "vazia" };

export function lerCelula(v: unknown): Celula {
  if (v === null || v === undefined || v === "") return { tipo: "vazia" };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { tipo: "vazia" };
    return { tipo: "numero", valor: v, dinheiro: !Number.isInteger(v) };
  }
  if (typeof v === "boolean") return { tipo: "texto", valor: v ? "Sim" : "Não" };
  if (v instanceof Date) return { tipo: "texto", valor: v.toLocaleDateString("pt-BR") };
  const s = String(v);
  if (DINHEIRO.test(s)) return { tipo: "numero", valor: Number(s), dinheiro: true };
  return { tipo: "texto", valor: s };
}

function xml(s: string): string {
  return (
    s
      // Caracteres de controle quebram o XML (o Excel recusa o arquivo).
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  );
}

/** 0 → "A", 26 → "AA". */
export function letraColuna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

/** Nome de aba aceito pelo Excel (até 31 caracteres, sem : \ / ? * [ ]). */
export function nomeAba(nome: string): string {
  const limpo = nome
    .replace(/[:\\/?*[\]]/g, " ")
    .trim()
    .slice(0, 31);
  return limpo || "Planilha";
}

// Estilos: 0 normal, 1 cabeçalho (negrito, fundo roxo claro), 2 dinheiro (#.##0,00).
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDE9FE"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function montarPlanilha(linhas: LinhaPlanilha[]): string {
  const chaves = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const titulos = chaves.map(tituloColuna);
  const larguras = titulos.map((t) => t.length);

  const celulaTexto = (ref: string, s: string, estilo = 0) =>
    `<c r="${ref}" t="inlineStr"${estilo ? ` s="${estilo}"` : ""}><is><t xml:space="preserve">${xml(s)}</t></is></c>`;

  const linhasXml: string[] = [
    `<row r="1">${titulos.map((t, i) => celulaTexto(`${letraColuna(i)}1`, t, 1)).join("")}</row>`,
  ];
  linhas.forEach((linha, li) => {
    const r = li + 2;
    const cels = chaves.map((k, ci) => {
      const ref = `${letraColuna(ci)}${r}`;
      const c = lerCelula(linha[k]);
      if (c.tipo === "vazia") return "";
      if (c.tipo === "numero") {
        larguras[ci] = Math.max(
          larguras[ci]!,
          (c.dinheiro ? c.valor.toFixed(2) : String(c.valor)).length + 2,
        );
        return `<c r="${ref}"${c.dinheiro ? ' s="2"' : ""}><v>${c.valor}</v></c>`;
      }
      larguras[ci] = Math.max(larguras[ci]!, c.valor.length);
      return celulaTexto(ref, c.valor);
    });
    linhasXml.push(`<row r="${r}">${cels.join("")}</row>`);
  });

  const ultima = `${letraColuna(Math.max(chaves.length - 1, 0))}${linhas.length + 1}`;
  const cols = larguras
    .map(
      (w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(w + 2, 8), 60)}" customWidth="1"/>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
${cols ? `<cols>${cols}</cols>` : ""}
<sheetData>${linhasXml.join("")}</sheetData>
${chaves.length ? `<autoFilter ref="A1:${ultima}"/>` : ""}
</worksheet>`;
}

/** Os arquivos (caminho → conteúdo) que formam o .xlsx. */
export function montarArquivosXlsx(
  linhas: LinhaPlanilha[],
  aba = "Planilha",
): Record<string, string> {
  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xml(nomeAba(aba))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    "xl/styles.xml": ESTILOS,
    "xl/worksheets/sheet1.xml": montarPlanilha(linhas),
  };
}

export async function gerarXlsx(linhas: LinhaPlanilha[], aba?: string): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const [caminho, conteudo] of Object.entries(montarArquivosXlsx(linhas, aba))) {
    zip.file(caminho, conteudo);
  }
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
}
