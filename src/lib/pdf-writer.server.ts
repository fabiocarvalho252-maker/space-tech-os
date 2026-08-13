// Shared pdf-lib layout primitives — extracted out of os-pdf.server.ts (the
// original, still only, caller) so a second PDF generator (aparelho-pdf.
// server.ts) doesn't have to re-implement text wrapping, page breaks, field
// rows and photo grids from scratch. Server-only.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// The standard 14 PDF fonts (Helvetica included) are WinAnsi-encoded — a
// superset of Latin-1 that covers every accented character Portuguese
// needs (ã, õ, á, é, í, ó, ú, ç, ê, ô, …), but not emoji or most other
// Unicode symbols. Free-text fields in this app are often typed with
// "✅"/"❌"/"⚠️" headers, which throws `WinAnsi cannot encode "✅" (0x2705)`
// and aborts PDF generation entirely. Readable stand-ins for the emoji
// people actually type — applied before the generic per-character fallback
// below so the PDF says "[OK]" instead of a bare "?" wherever possible.
const EMOJI_SUBSTITUICOES: Record<string, string> = {
  "✅": "[OK]",
  "✔️": "[OK]",
  "✔": "[OK]",
  "❌": "[X]",
  "⚠️": "[ATENCAO]",
  "⚠": "[ATENCAO]",
  "🔧": "[SERVICO]",
  "📱": "[APARELHO]",
  "📋": "[INFORMACOES]",
  "📄": "[PDF]",
  "📞": "[TELEFONE]",
  "💰": "[VALOR]",
  "🔒": "[SEGURANCA]",
  "❗": "[!]",
  "❓": "[?]",
  "➡️": "->",
  "➡": "->",
  "→": "->",
  "←": "<-",
  "★": "*",
  "•": "-",
};

// Central sanitizer: every dynamic string reaching the PDF goes through
// this before drawText()/widthOfTextAtSize() ever see it. Only the PDF
// output is affected: the web UI still renders the original text with
// emoji intact, and nothing is written back to the database.
export function sanitizePdfText(texto: string | null | undefined, fonte: PDFFont): string {
  if (texto == null) return "";
  let resultado = String(texto);
  for (const [emoji, substituto] of Object.entries(EMOJI_SUBSTITUICOES)) {
    if (resultado.includes(emoji)) resultado = resultado.split(emoji).join(substituto);
  }
  // Catch-all for any character WinAnsi still can't encode (other emoji,
  // rare symbols, …) that isn't in the explicit map above — actually asks
  // the font itself rather than guessing a codepoint range, so it can
  // never miss a case pdf-lib would otherwise throw on.
  return Array.from(resultado)
    .map((caractere) => {
      try {
        fonte.widthOfTextAtSize(caractere, 10);
        return caractere;
      } catch {
        return "?";
      }
    })
    .join("");
}

export const MARGEM = 48;
export const LARGURA_PAGINA = 595.28; // A4 pt
export const ALTURA_PAGINA = 841.89;
export const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2;

export class Escritor {
  private pdf: PDFDocument;
  private fonte: PDFFont;
  private fonteNegrito: PDFFont;
  private corAccent: ReturnType<typeof rgb>;
  private pagina: PDFPage;
  private y: number;

  constructor(
    pdf: PDFDocument,
    fonte: PDFFont,
    fonteNegrito: PDFFont,
    corAccent: ReturnType<typeof rgb>,
  ) {
    this.pdf = pdf;
    this.fonte = fonte;
    this.fonteNegrito = fonteNegrito;
    this.corAccent = corAccent;
    this.pagina = pdf.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
    this.desenharFaixaTopo();
    this.y = ALTURA_PAGINA - MARGEM;
  }

  private desenharFaixaTopo() {
    this.pagina.drawRectangle({
      x: 0,
      y: ALTURA_PAGINA - 8,
      width: LARGURA_PAGINA,
      height: 8,
      color: this.corAccent,
    });
  }

  private quebrarLinha() {
    this.pagina = this.pdf.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
    this.desenharFaixaTopo();
    this.y = ALTURA_PAGINA - MARGEM;
  }

  novaPagina() {
    this.quebrarLinha();
  }

  private garantirEspaco(altura: number) {
    if (this.y - altura < MARGEM) this.quebrarLinha();
  }

  private quebrarTexto(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
    const palavras = texto.split(/\s+/);
    const linhas: string[] = [];
    let atual = "";
    for (const palavra of palavras) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    }
    if (atual) linhas.push(atual);
    return linhas;
  }

  titulo(texto: string, tamanho = 16) {
    this.garantirEspaco(tamanho + 8);
    this.pagina.drawText(sanitizePdfText(texto, this.fonte), {
      x: MARGEM,
      y: this.y,
      size: tamanho,
      font: this.fonteNegrito,
      color: this.corAccent,
    });
    this.y -= tamanho + 8;
  }

  subtitulo(texto: string, cor: ReturnType<typeof rgb> = this.corAccent) {
    this.garantirEspaco(16);
    this.pagina.drawText(sanitizePdfText(texto, this.fonte), {
      x: MARGEM,
      y: this.y,
      size: 11,
      font: this.fonteNegrito,
      color: cor,
    });
    this.y -= 16;
  }

  paragrafo(texto: string, tamanho = 9, cor = rgb(0.2, 0.2, 0.25)) {
    const linhas = this.quebrarTexto(
      sanitizePdfText(texto, this.fonte),
      this.fonte,
      tamanho,
      LARGURA_UTIL,
    );
    for (const linha of linhas) {
      this.garantirEspaco(tamanho + 4);
      this.pagina.drawText(linha, {
        x: MARGEM,
        y: this.y,
        size: tamanho,
        font: this.fonte,
        color: cor,
      });
      this.y -= tamanho + 4;
    }
  }

  linhaCampo(rotulo: string, valor: string) {
    this.garantirEspaco(14);
    this.pagina.drawText(sanitizePdfText(rotulo, this.fonte), {
      x: MARGEM,
      y: this.y,
      size: 9,
      font: this.fonteNegrito,
      color: rgb(0.45, 0.45, 0.5),
    });
    const linhas = this.quebrarTexto(
      sanitizePdfText(valor, this.fonte) || "—",
      this.fonte,
      9,
      LARGURA_UTIL - 130,
    );
    this.pagina.drawText(linhas[0] ?? "—", {
      x: MARGEM + 130,
      y: this.y,
      size: 9,
      font: this.fonte,
      color: rgb(0.1, 0.1, 0.15),
    });
    this.y -= 14;
    for (const extra of linhas.slice(1)) {
      this.garantirEspaco(14);
      this.pagina.drawText(extra, {
        x: MARGEM + 130,
        y: this.y,
        size: 9,
        font: this.fonte,
        color: rgb(0.1, 0.1, 0.15),
      });
      this.y -= 14;
    }
  }

  espaco(altura = 10) {
    this.y -= altura;
  }

  linhaDivisoria() {
    this.garantirEspaco(10);
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: LARGURA_PAGINA - MARGEM, y: this.y },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.88),
    });
    this.y -= 10;
  }

  async imagem(bytes: Uint8Array, ehPng: boolean, larguraMax: number, alturaMax: number) {
    try {
      const img = ehPng ? await this.pdf.embedPng(bytes) : await this.pdf.embedJpg(bytes);
      const escala = Math.min(larguraMax / img.width, alturaMax / img.height, 1);
      const largura = img.width * escala;
      const altura = img.height * escala;
      this.garantirEspaco(altura + 6);
      this.pagina.drawImage(img, { x: MARGEM, y: this.y - altura, width: largura, height: altura });
      this.y -= altura + 6;
    } catch {
      // Imagem corrompida ou formato inesperado — segue sem travar o PDF inteiro.
    }
  }

  // Lays out photos in a `colunas`-wide grid.
  async imagensGrade(
    itens: { bytes: Uint8Array; ehPng: boolean; legenda: string }[],
    colunas: number,
  ) {
    const gap = 8;
    const alturaMax = 90;
    const larguraCel = (LARGURA_UTIL - gap * (colunas - 1)) / colunas;
    for (let i = 0; i < itens.length; i += colunas) {
      const linha = itens.slice(i, i + colunas);
      this.garantirEspaco(alturaMax + 16);
      const yLinha = this.y;
      let alturaUsada = 0;
      for (let c = 0; c < linha.length; c++) {
        const item = linha[c]!;
        try {
          const img = item.ehPng
            ? await this.pdf.embedPng(item.bytes)
            : await this.pdf.embedJpg(item.bytes);
          const escala = Math.min(larguraCel / img.width, alturaMax / img.height, 1);
          const largura = img.width * escala;
          const altura = img.height * escala;
          const x = MARGEM + c * (larguraCel + gap);
          this.pagina.drawImage(img, { x, y: yLinha - altura, width: largura, height: altura });
          this.pagina.drawText(sanitizePdfText(item.legenda, this.fonte), {
            x,
            y: yLinha - altura - 9,
            size: 7,
            font: this.fonte,
            color: rgb(0.6, 0.6, 0.65),
          });
          alturaUsada = Math.max(alturaUsada, altura + 15);
        } catch {
          // Imagem corrompida ou formato inesperado — segue sem travar o PDF inteiro.
        }
      }
      this.y = yLinha - alturaUsada - 6;
    }
  }
}

/** Convenience: a fresh A4 PDFDocument + Helvetica/HelveticaBold fonts + an Escritor ready to draw. */
export async function criarEscritor(corAccent: ReturnType<typeof rgb>) {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Escritor(pdf, fonte, fonteNegrito, corAccent);
  return { pdf, fonte, fonteNegrito, w };
}
