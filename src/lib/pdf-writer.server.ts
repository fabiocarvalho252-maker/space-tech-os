// Shared pdf-lib layout primitives — extracted out of os-pdf.server.ts (the
// original, still only, caller) so a second PDF generator (aparelho-pdf.
// server.ts) doesn't have to re-implement text wrapping, page breaks, field
// rows and photo grids from scratch. Server-only.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import jpeg from "jpeg-js";

// Fotos de celular chegam com 3–4 MB cada e iam para o PDF no tamanho
// original (um PDF com 2 fotos passava de 5 MB, pesado para o WhatsApp).
// Reduz o lado maior para no máximo LADO_MAX_PX e recomprime. jpeg-js é JS
// puro de propósito: o build do Lovable roda em Cloudflare, onde libs
// nativas (sharp) não funcionam. Só JPEG — PNG (logo, assinatura, QR) já é
// pequeno. Qualquer falha devolve a imagem original.
const LADO_MAX_PX = 1200;
const QUALIDADE_JPEG = 72;
const LIMITE_REDUZIR_BYTES = 300 * 1024;

export function reduzirJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes.length < LIMITE_REDUZIR_BYTES) return bytes;
  try {
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024 });
    const escala = Math.min(1, LADO_MAX_PX / Math.max(img.width, img.height));
    const largura = Math.max(1, Math.round(img.width * escala));
    const altura = Math.max(1, Math.round(img.height * escala));
    const destino =
      escala < 1 ? reduzirPixels(img.data, img.width, img.height, largura, altura) : img.data;
    const saida = jpeg.encode(
      { data: destino, width: largura, height: altura },
      QUALIDADE_JPEG,
    ).data;
    return saida.length < bytes.length ? new Uint8Array(saida) : bytes;
  } catch {
    return bytes;
  }
}

// Redução por média de área (box filter): cada pixel de destino é a média do
// bloco de origem que ele cobre — sem o serrilhado de pegar 1 pixel a cada N.
function reduzirPixels(
  origem: Uint8Array,
  largOrig: number,
  altOrig: number,
  largDest: number,
  altDest: number,
): Uint8Array {
  const destino = new Uint8Array(largDest * altDest * 4);
  const fx = largOrig / largDest;
  const fy = altOrig / altDest;
  for (let y = 0; y < altDest; y++) {
    const y0 = Math.floor(y * fy);
    const y1 = Math.min(altOrig, Math.max(y0 + 1, Math.floor((y + 1) * fy)));
    for (let x = 0; x < largDest; x++) {
      const x0 = Math.floor(x * fx);
      const x1 = Math.min(largOrig, Math.max(x0 + 1, Math.floor((x + 1) * fx)));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let yy = y0; yy < y1; yy++) {
        let i = (yy * largOrig + x0) * 4;
        for (let xx = x0; xx < x1; xx++, i += 4) {
          r += origem[i]!;
          g += origem[i + 1]!;
          b += origem[i + 2]!;
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      const d = (y * largDest + x) * 4;
      destino[d] = r / n;
      destino[d + 1] = g / n;
      destino[d + 2] = b / n;
      destino[d + 3] = 255;
    }
  }
  return destino;
}

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
  // Tab vira espaço; quebras de linha são tratadas por paragrafo()/linhaCampo()
  // antes de chegar aqui — WinAnsi não codifica "\n", que virava "?" no PDF.
  let resultado = String(texto).replace(/\t/g, " ");
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
  // Quebra de página só é criada quando algo for desenhado depois dela —
  // senão um "quebra_pagina" no fim do modelo (ou seguido de seções vazias)
  // gerava uma última página em branco.
  private quebraPendente = false;

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
    if (this.y < ALTURA_PAGINA - MARGEM) this.quebraPendente = true;
  }

  private garantirEspaco(altura: number) {
    if (this.quebraPendente || this.y - altura < MARGEM) {
      this.quebraPendente = false;
      this.quebrarLinha();
    }
  }

  // drawText() posiciona pela linha de base; os métodos de texto tratam
  // this.y como o topo da linha, então descem a altura das maiúsculas antes
  // de desenhar. Sem isso o texto logo abaixo de uma imagem (ex.: o nome da
  // loja embaixo da logo) subia por cima dela.
  private baseline(tamanho: number) {
    return this.y - tamanho * 0.75;
  }

  private linhasDoTexto(texto: string): string[] {
    return String(texto ?? "").split(/\r?\n/);
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
      y: this.baseline(tamanho),
      size: tamanho,
      font: this.fonteNegrito,
      color: this.corAccent,
    });
    this.y -= tamanho + 8;
  }

  subtitulo(texto: string, cor: ReturnType<typeof rgb> = this.corAccent) {
    // Respiro antes do título de seção (dispensado no topo da página).
    if (this.y < ALTURA_PAGINA - MARGEM && !this.quebraPendente) this.y -= 6;
    this.garantirEspaco(16);
    this.pagina.drawText(sanitizePdfText(texto, this.fonte), {
      x: MARGEM,
      y: this.baseline(11),
      size: 11,
      font: this.fonteNegrito,
      color: cor,
    });
    this.y -= 16;
  }

  paragrafo(texto: string, tamanho = 9, cor = rgb(0.2, 0.2, 0.25)) {
    // Respeita as quebras de linha digitadas (termos, observações…); linhas
    // em branco viram meio espaço entre blocos.
    for (const bloco of this.linhasDoTexto(texto)) {
      if (!bloco.trim()) {
        this.y -= (tamanho + 4) / 2;
        continue;
      }
      const linhas = this.quebrarTexto(
        sanitizePdfText(bloco, this.fonte),
        this.fonte,
        tamanho,
        LARGURA_UTIL,
      );
      for (const linha of linhas) {
        this.garantirEspaco(tamanho + 4);
        this.pagina.drawText(linha, {
          x: MARGEM,
          y: this.baseline(tamanho),
          size: tamanho,
          font: this.fonte,
          color: cor,
        });
        this.y -= tamanho + 4;
      }
    }
  }

  linhaCampo(rotulo: string, valor: string) {
    this.garantirEspaco(14);
    this.pagina.drawText(sanitizePdfText(rotulo, this.fonte), {
      x: MARGEM,
      y: this.baseline(9),
      size: 9,
      font: this.fonteNegrito,
      color: rgb(0.45, 0.45, 0.5),
    });
    const linhas = this.linhasDoTexto(valor)
      .filter((l) => l.trim())
      .flatMap((l) =>
        this.quebrarTexto(sanitizePdfText(l, this.fonte), this.fonte, 9, LARGURA_UTIL - 130),
      );
    this.pagina.drawText(linhas[0] ?? "—", {
      x: MARGEM + 130,
      y: this.baseline(9),
      size: 9,
      font: this.fonte,
      color: rgb(0.1, 0.1, 0.15),
    });
    this.y -= 14;
    for (const extra of linhas.slice(1)) {
      this.garantirEspaco(14);
      this.pagina.drawText(extra, {
        x: MARGEM + 130,
        y: this.baseline(9),
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
      const img = ehPng
        ? await this.pdf.embedPng(bytes)
        : await this.pdf.embedJpg(reduzirJpeg(bytes));
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
            : await this.pdf.embedJpg(reduzirJpeg(item.bytes));
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
