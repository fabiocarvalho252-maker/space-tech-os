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
  const orientacao = lerOrientacaoExif(bytes);
  if (bytes.length < LIMITE_REDUZIR_BYTES && orientacao === 1) return bytes;
  try {
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024 });
    const escala = Math.min(1, LADO_MAX_PX / Math.max(img.width, img.height));
    const largura = Math.max(1, Math.round(img.width * escala));
    const altura = Math.max(1, Math.round(img.height * escala));
    const reduzida =
      escala < 1 ? reduzirPixels(img.data, img.width, img.height, largura, altura) : img.data;
    const girada = aplicarOrientacao(reduzida, largura, altura, orientacao);
    const saida = jpeg.encode(girada, QUALIDADE_JPEG).data;
    // Foto girada sempre usa a recomprimida (a original sairia deitada no PDF).
    return orientacao !== 1 || saida.length < bytes.length ? new Uint8Array(saida) : bytes;
  } catch {
    return bytes;
  }
}

// Celular grava a foto "deitada" e anota no EXIF quanto girar (tag 0x0112).
// Galeria e navegador respeitam isso; pdf-lib e jpeg-js não — sem aplicar
// aqui, foto tirada em pé saía deitada no PDF. 1 = já está em pé.
export function lerOrientacaoExif(bytes: Uint8Array): number {
  try {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
    let i = 2;
    while (i + 4 < bytes.length && bytes[i] === 0xff) {
      const marcador = bytes[i + 1]!;
      const tamanho = (bytes[i + 2]! << 8) | bytes[i + 3]!;
      // APP1 com cabeçalho "Exif\0\0".
      if (
        marcador === 0xe1 &&
        bytes[i + 4] === 0x45 &&
        bytes[i + 5] === 0x78 &&
        bytes[i + 6] === 0x69 &&
        bytes[i + 7] === 0x66
      ) {
        const tiff = i + 10;
        const le = bytes[tiff] === 0x49; // "II" = little-endian, "MM" = big-endian
        const u16 = (o: number) =>
          le ? bytes[o]! | (bytes[o + 1]! << 8) : (bytes[o]! << 8) | bytes[o + 1]!;
        const u32 = (o: number) =>
          le
            ? (bytes[o]! | (bytes[o + 1]! << 8) | (bytes[o + 2]! << 16) | (bytes[o + 3]! << 24)) >>>
              0
            : ((bytes[o]! << 24) | (bytes[o + 1]! << 16) | (bytes[o + 2]! << 8) | bytes[o + 3]!) >>>
              0;
        const ifd = tiff + u32(tiff + 4);
        const entradas = u16(ifd);
        for (let e = 0; e < entradas; e++) {
          const entrada = ifd + 2 + e * 12;
          if (u16(entrada) === 0x0112) {
            const valor = u16(entrada + 8);
            return valor >= 1 && valor <= 8 ? valor : 1;
          }
        }
        return 1;
      }
      if (marcador === 0xda) break; // início dos dados da imagem: não há mais metadados
      i += 2 + tamanho;
    }
  } catch {
    // EXIF malformado — trata como sem rotação.
  }
  return 1;
}

function aplicarOrientacao(
  origem: Uint8Array,
  larg: number,
  alt: number,
  orientacao: number,
): { data: Uint8Array; width: number; height: number } {
  if (orientacao === 1) return { data: origem, width: larg, height: alt };
  const troca = orientacao >= 5; // 5–8 giram 90°: largura e altura se invertem
  const largDest = troca ? alt : larg;
  const altDest = troca ? larg : alt;
  const destino = new Uint8Array(largDest * altDest * 4);
  for (let dy = 0; dy < altDest; dy++) {
    for (let dx = 0; dx < largDest; dx++) {
      let sx: number;
      let sy: number;
      switch (orientacao) {
        case 2:
          sx = larg - 1 - dx;
          sy = dy;
          break; // espelhada
        case 3:
          sx = larg - 1 - dx;
          sy = alt - 1 - dy;
          break; // 180°
        case 4:
          sx = dx;
          sy = alt - 1 - dy;
          break; // espelhada na vertical
        case 5:
          sx = dy;
          sy = dx;
          break; // transposta
        case 6:
          sx = dy;
          sy = alt - 1 - dx;
          break; // 90° horário
        case 7:
          sx = larg - 1 - dy;
          sy = alt - 1 - dx;
          break; // transversa
        default:
          sx = larg - 1 - dy;
          sy = dx;
          break; // 8: 90° anti-horário
      }
      const o = (sy * larg + sx) * 4;
      const d = (dy * largDest + dx) * 4;
      destino[d] = origem[o]!;
      destino[d + 1] = origem[o + 1]!;
      destino[d + 2] = origem[o + 2]!;
      destino[d + 3] = 255;
    }
  }
  return { data: destino, width: largDest, height: altDest };
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

  // ---- Blocos de documento (PDF de OS/Orçamento para o cliente) ----------

  private texto(
    t: string,
    x: number,
    y: number,
    tamanho: number,
    negrito = false,
    cor = rgb(0.1, 0.1, 0.15),
  ) {
    this.pagina.drawText(sanitizePdfText(t, this.fonte), {
      x,
      y,
      size: tamanho,
      font: negrito ? this.fonteNegrito : this.fonte,
      color: cor,
    });
  }

  private larguraTexto(t: string, tamanho: number, negrito = false) {
    return (negrito ? this.fonteNegrito : this.fonte).widthOfTextAtSize(
      sanitizePdfText(t, this.fonte),
      tamanho,
    );
  }

  /** Corta o texto com "…" para caber na largura. */
  private caber(t: string, tamanho: number, largura: number, negrito = false) {
    let s = sanitizePdfText(t, this.fonte);
    if (this.larguraTexto(s, tamanho, negrito) <= largura) return s;
    while (s.length > 1 && this.larguraTexto(s + "...", tamanho, negrito) > largura) {
      s = s.slice(0, -1);
    }
    return s + "...";
  }

  /**
   * Cabeçalho: logo + loja à esquerda; à direita um quadro com o tipo do
   * documento, número, data e status.
   */
  async cabecalhoDocumento(p: {
    logo: { bytes: Uint8Array; ehPng: boolean } | null;
    loja: string;
    linhasLoja: string[];
    documento: string;
    numero: string;
    data: string;
    status: string | null;
  }) {
    const topo = this.y;
    let xTexto = MARGEM;
    if (p.logo) {
      try {
        const img = p.logo.ehPng
          ? await this.pdf.embedPng(p.logo.bytes)
          : await this.pdf.embedJpg(reduzirJpeg(p.logo.bytes));
        const escala = Math.min(54 / img.width, 54 / img.height, 1);
        this.pagina.drawImage(img, {
          x: MARGEM,
          y: topo - img.height * escala,
          width: img.width * escala,
          height: img.height * escala,
        });
        xTexto = MARGEM + img.width * escala + 10;
      } catch {
        // logo inválida — segue só com o nome
      }
    }
    const larguraQuadro = 170;
    const xQuadro = LARGURA_PAGINA - MARGEM - larguraQuadro;
    const larguraLoja = xQuadro - xTexto - 12;
    this.texto(this.caber(p.loja, 15, larguraLoja, true), xTexto, topo - 14, 15, true);
    let yl = topo - 28;
    for (const linha of p.linhasLoja) {
      for (const parte of this.quebrarTexto(
        sanitizePdfText(linha, this.fonte),
        this.fonte,
        7.5,
        larguraLoja,
      )) {
        this.texto(parte, xTexto, yl, 7.5, false, rgb(0.42, 0.42, 0.48));
        yl -= 10;
      }
    }

    const alturaQuadro = p.status ? 66 : 52;
    this.pagina.drawRectangle({
      x: xQuadro,
      y: topo - alturaQuadro,
      width: larguraQuadro,
      height: alturaQuadro,
      color: this.corSuave(),
      borderColor: this.corAccent,
      borderWidth: 0.8,
    });
    this.texto(p.documento.toUpperCase(), xQuadro + 10, topo - 15, 8, true, this.corAccent);
    this.texto(p.numero, xQuadro + 10, topo - 32, 15, true);
    this.texto(p.data, xQuadro + 10, topo - 45, 7.5, false, rgb(0.4, 0.4, 0.46));
    if (p.status) {
      this.texto(`Situação: ${p.status}`, xQuadro + 10, topo - 58, 7.5, true, this.corAccent);
    }

    this.y = Math.min(yl, topo - alturaQuadro) - 14;
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y,
      width: LARGURA_UTIL,
      height: 1.5,
      color: this.corAccent,
    });
    this.y -= 14;
  }

  private corSuave() {
    const c = this.corAccent as unknown as { red: number; green: number; blue: number };
    const mistura = (v: number) => 1 - (1 - v) * 0.08;
    return rgb(mistura(c.red), mistura(c.green), mistura(c.blue));
  }

  /** Título de seção: marcador colorido + texto em caixa alta + linha fina. */
  secao(titulo: string) {
    if (this.y < ALTURA_PAGINA - MARGEM && !this.quebraPendente) this.y -= 8;
    // Reserva o título + as primeiras linhas do conteúdo, para o título
    // nunca ficar sozinho no pé da página.
    this.garantirEspaco(70);
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - 11,
      width: 3,
      height: 12,
      color: this.corAccent,
    });
    this.texto(titulo.toUpperCase(), MARGEM + 9, this.y - 9.5, 9.5, true, this.corAccent);
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y - 17 },
      end: { x: LARGURA_PAGINA - MARGEM, y: this.y - 17 },
      thickness: 0.4,
      color: rgb(0.86, 0.86, 0.9),
    });
    this.y -= 25;
  }

  /** Campos em grade (rótulo pequeno em cima, valor embaixo). */
  grade(campos: [string, string][], colunas = 2) {
    const visiveis = campos.filter(([, v]) => v && v.trim());
    const gap = 14;
    const larguraCol = (LARGURA_UTIL - gap * (colunas - 1)) / colunas;
    for (let i = 0; i < visiveis.length; i += colunas) {
      const linha = visiveis.slice(i, i + colunas);
      const valores = linha.map(([, v]) =>
        this.linhasDoTexto(v)
          .filter((l) => l.trim())
          .flatMap((l) =>
            this.quebrarTexto(sanitizePdfText(l, this.fonte), this.fonte, 9.5, larguraCol),
          ),
      );
      const alturaLinha = 12 + Math.max(...valores.map((v) => v.length)) * 12 + 6;
      this.garantirEspaco(alturaLinha);
      linha.forEach(([rotulo], c) => {
        const x = MARGEM + c * (larguraCol + gap);
        this.texto(rotulo.toUpperCase(), x, this.y - 7, 6.5, true, rgb(0.5, 0.5, 0.56));
        valores[c]!.forEach((l, k) => this.texto(l, x, this.y - 19 - k * 12, 9.5));
      });
      this.y -= alturaLinha;
    }
  }

  /** Tabela com cabeçalho colorido e linhas zebradas. */
  tabela(colunas: { titulo: string; largura: number; direita?: boolean }[], linhas: string[][]) {
    const totalLarg = colunas.reduce((s, c) => s + c.largura, 0);
    const larguras = colunas.map((c) => (c.largura / totalLarg) * LARGURA_UTIL);
    const desenharCabecalho = () => {
      this.garantirEspaco(40);
      this.pagina.drawRectangle({
        x: MARGEM,
        y: this.y - 18,
        width: LARGURA_UTIL,
        height: 18,
        color: this.corAccent,
      });
      let x = MARGEM;
      colunas.forEach((c, i) => {
        const t = c.titulo.toUpperCase();
        const tx = c.direita ? x + larguras[i]! - 6 - this.larguraTexto(t, 7, true) : x + 6;
        this.texto(t, tx, this.y - 12, 7, true, rgb(1, 1, 1));
        x += larguras[i]!;
      });
      this.y -= 18;
    };
    desenharCabecalho();
    linhas.forEach((linha, n) => {
      const quebras = linha.map((v, i) =>
        i === 0
          ? this.quebrarTexto(sanitizePdfText(v, this.fonte), this.fonte, 8.5, larguras[0]! - 12)
          : [this.caber(v, 8.5, larguras[i]! - 12)],
      );
      const altura = Math.max(...quebras.map((q) => q.length)) * 11 + 9;
      if (this.y - altura < MARGEM) {
        this.quebrarLinha();
        desenharCabecalho();
      }
      if (n % 2 === 1) {
        this.pagina.drawRectangle({
          x: MARGEM,
          y: this.y - altura,
          width: LARGURA_UTIL,
          height: altura,
          color: rgb(0.965, 0.965, 0.975),
        });
      }
      let x = MARGEM;
      quebras.forEach((q, i) => {
        q.forEach((l, k) => {
          const tx = colunas[i]!.direita ? x + larguras[i]! - 6 - this.larguraTexto(l, 8.5) : x + 6;
          this.texto(l, tx, this.y - 12 - k * 11, 8.5);
        });
        x += larguras[i]!;
      });
      this.y -= altura;
    });
    this.pagina.drawLine({
      start: { x: MARGEM, y: this.y },
      end: { x: LARGURA_PAGINA - MARGEM, y: this.y },
      thickness: 0.6,
      color: rgb(0.85, 0.85, 0.9),
    });
    this.y -= 6;
  }

  /** Quadro de totais alinhado à direita; a última linha é o total em destaque. */
  totais(linhas: [string, string][], total: [string, string]) {
    const largura = 220;
    const x = LARGURA_PAGINA - MARGEM - largura;
    const altura = linhas.length * 14 + 34;
    this.garantirEspaco(altura + 6);
    let y = this.y - 6;
    for (const [r, v] of linhas) {
      this.texto(r, x + 10, y - 9, 8.5, false, rgb(0.4, 0.4, 0.46));
      this.texto(v, x + largura - 10 - this.larguraTexto(v, 8.5), y - 9, 8.5);
      y -= 14;
    }
    this.pagina.drawRectangle({
      x,
      y: y - 26,
      width: largura,
      height: 24,
      color: this.corAccent,
    });
    this.texto(total[0].toUpperCase(), x + 10, y - 17.5, 9, true, rgb(1, 1, 1));
    this.texto(
      total[1],
      x + largura - 10 - this.larguraTexto(total[1], 13, true),
      y - 19,
      13,
      true,
      rgb(1, 1, 1),
    );
    this.y = y - 34;
  }

  /** Caixa de aviso/explicação com fundo suave e borda à esquerda. */
  aviso(titulo: string, texto: string, tom: "accent" | "verde" | "amarelo" = "accent") {
    const cores = {
      accent: { fundo: this.corSuave(), borda: this.corAccent },
      verde: { fundo: rgb(0.93, 0.98, 0.95), borda: rgb(0.09, 0.6, 0.35) },
      amarelo: { fundo: rgb(1, 0.97, 0.9), borda: rgb(0.85, 0.55, 0.05) },
    }[tom];
    const larguraTexto = LARGURA_UTIL - 26;
    const linhas = this.linhasDoTexto(texto)
      .filter((l) => l.trim())
      .flatMap((l) =>
        this.quebrarTexto(sanitizePdfText(l, this.fonte), this.fonte, 8.5, larguraTexto),
      );
    const altura = 24 + linhas.length * 11.5 + 4;
    if (this.y < ALTURA_PAGINA - MARGEM && !this.quebraPendente) this.y -= 6;
    this.garantirEspaco(altura + 6);
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - altura,
      width: LARGURA_UTIL,
      height: altura,
      color: cores.fundo,
    });
    this.pagina.drawRectangle({
      x: MARGEM,
      y: this.y - altura,
      width: 3,
      height: altura,
      color: cores.borda,
    });
    this.texto(titulo, MARGEM + 13, this.y - 15, 9.5, true, cores.borda);
    linhas.forEach((l, k) => this.texto(l, MARGEM + 13, this.y - 29 - k * 11.5, 8.5));
    this.y -= altura + 6;
  }

  /** QR Code ao lado de um texto curto (link de consulta/aprovação). */
  async qrComTexto(png: Uint8Array, titulo: string, texto: string) {
    const lado = 74;
    this.garantirEspaco(lado + 10);
    try {
      const img = await this.pdf.embedPng(png);
      this.pagina.drawImage(img, { x: MARGEM, y: this.y - lado, width: lado, height: lado });
    } catch {
      // QR inválido — segue só com o texto
    }
    const x = MARGEM + lado + 14;
    this.texto(titulo, x, this.y - 20, 10, true, this.corAccent);
    this.quebrarTexto(sanitizePdfText(texto, this.fonte), this.fonte, 8.5, LARGURA_UTIL - lado - 14)
      .slice(0, 4)
      .forEach((l, k) => this.texto(l, x, this.y - 34 - k * 11.5, 8.5, false, rgb(0.3, 0.3, 0.36)));
    this.y -= lado + 10;
  }

  /** Linhas de assinatura lado a lado, com a imagem da assinatura quando houver. */
  async assinaturas(
    itens: {
      rotulo: string;
      nome?: string | null;
      imagem?: { bytes: Uint8Array; ehPng: boolean } | null;
    }[],
  ) {
    const gap = 30;
    const largura = (LARGURA_UTIL - gap * (itens.length - 1)) / itens.length;
    this.garantirEspaco(80);
    const yLinha = this.y - 56;
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i]!;
      const x = MARGEM + i * (largura + gap);
      if (item.imagem) {
        try {
          const img = item.imagem.ehPng
            ? await this.pdf.embedPng(item.imagem.bytes)
            : await this.pdf.embedJpg(reduzirJpeg(item.imagem.bytes));
          const escala = Math.min((largura - 20) / img.width, 46 / img.height, 1);
          this.pagina.drawImage(img, {
            x: x + (largura - img.width * escala) / 2,
            y: yLinha + 3,
            width: img.width * escala,
            height: img.height * escala,
          });
        } catch {
          // assinatura inválida — fica só a linha
        }
      }
      this.pagina.drawLine({
        start: { x, y: yLinha },
        end: { x: x + largura, y: yLinha },
        thickness: 0.7,
        color: rgb(0.3, 0.3, 0.35),
      });
      const rotulo = item.nome ? `${item.rotulo} — ${item.nome}` : item.rotulo;
      const t = this.caber(rotulo, 7.5, largura);
      this.texto(
        t,
        x + (largura - this.larguraTexto(t, 7.5)) / 2,
        yLinha - 11,
        7.5,
        false,
        rgb(0.4, 0.4, 0.46),
      );
    }
    this.y = yLinha - 22;
  }

  /** Rodapé em todas as páginas: texto à esquerda e "Página X de Y" à direita. */
  rodape(texto: string) {
    const paginas = this.pdf.getPages();
    paginas.forEach((pg, i) => {
      pg.drawLine({
        start: { x: MARGEM, y: 34 },
        end: { x: LARGURA_PAGINA - MARGEM, y: 34 },
        thickness: 0.4,
        color: rgb(0.86, 0.86, 0.9),
      });
      const esquerda = this.caber(texto, 7, LARGURA_UTIL - 80);
      pg.drawText(esquerda, {
        x: MARGEM,
        y: 24,
        size: 7,
        font: this.fonte,
        color: rgb(0.5, 0.5, 0.56),
      });
      const dir = `Página ${i + 1} de ${paginas.length}`;
      pg.drawText(dir, {
        x: LARGURA_PAGINA - MARGEM - this.fonte.widthOfTextAtSize(dir, 7),
        y: 24,
        size: 7,
        font: this.fonte,
        color: rgb(0.5, 0.5, 0.56),
      });
    });
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
