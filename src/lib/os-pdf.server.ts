// Generates an actual PDF file (not just the client-side print popup HTML
// ordens.tsx's imprimir() uses) for a service order, so it can be attached
// to a WhatsApp notification. Server-only: uses supabaseAdmin to read
// across tables regardless of the caller's RLS session and to download
// signature/gallery images straight from storage (no signed URL round-trip
// needed server-side). Respects the empresa's selected "Modelos de OS"
// template the same way ordens.tsx's imprimir() does — theme color, which
// sections to include and in what order, and the photo grid layout — just
// laid out with pdf-lib instead of HTML. QR code section is accepted in the
// section list but not rendered here: there's no raster QR generator
// dependency in this project (qrcode.react only renders SVG, browser-side)
// and no public origin available in this server context to encode.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  FALLBACK_TEMPLATE,
  TEMA_RGB,
  fotosGridColunas,
  secoesOrdenadas,
  type OsTemplateRow,
  type OsTemplateSecao,
} from "@/lib/os-template-render";

const CHECKLIST_LABELS: Record<string, string> = {
  liga: "Liga",
  desliga: "Desliga",
  tela: "Tela",
  touch: "Touch",
  cameras: "Câmeras",
  flash: "Flash",
  alto_falante: "Alto-falante",
  microfone: "Microfone",
  vibracao: "Vibração",
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  rede_movel: "Rede móvel",
  carregamento: "Carregamento",
  biometria: "Biometria",
  face_id: "Face ID",
  botoes: "Botões",
  sensores: "Sensores",
  nfc: "NFC",
};

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  defeito: "Defeito",
  nao_testado: "Não testado",
  nao_se_aplica: "N/A",
};

const ESTADO_FISICO_LABELS: Record<string, string> = {
  tela_trincada: "Tela trincada",
  tela_riscada: "Tela riscada",
  tampa_quebrada: "Tampa traseira quebrada",
  carcaca_amassada: "Carcaça amassada",
  camera_danificada: "Câmera danificada",
  oxidacao: "Oxidação",
  sinais_liquido: "Sinais de líquido",
  parafusos_ausentes: "Parafusos ausentes",
  lacre_violado: "Lacre violado",
  outros: "Outros",
};

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataBR = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

// The standard 14 PDF fonts (Helvetica included) are WinAnsi-encoded — a
// superset of Latin-1 that covers every accented character Portuguese
// needs (ã, õ, á, é, í, ó, ú, ç, ê, ô, …), but not emoji or most other
// Unicode symbols. Termos de garantia and other free-text fields in this
// app are often typed with "✅"/"❌"/"⚠️" headers, which throws
// `WinAnsi cannot encode "✅" (0x2705)` and aborts PDF generation entirely.
// Readable stand-ins for the emoji people actually type in those texts —
// applied before the generic per-character fallback below so the PDF says
// "[OK]" instead of a bare "?" wherever possible.
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

// Central sanitizer: every dynamic string reaching the PDF (termos,
// garantia, defeito, diagnóstico, nomes, observações, ...) goes through
// this before drawText()/widthOfTextAtSize() ever see it — called once,
// from inside Escritor's own text methods, rather than at every call site
// in gerarPdfOs() below. Only the PDF output is affected: the web UI still
// renders the original text with emoji intact, and nothing is written back
// to the database.
function sanitizePdfText(texto: string | null | undefined, fonte: PDFFont): string {
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

const MARGEM = 48;
const LARGURA_PAGINA = 595.28; // A4 pt
const ALTURA_PAGINA = 841.89;
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2;

class Escritor {
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

  // Colored band matching the template's tema, drawn on every page — the
  // pdf-lib layout has no header banner/cards like the HTML template does,
  // so this is what makes "qual modelo" visually recognizable at a glance
  // instead of every tema looking like plain black-on-white text.
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

  // Explicit page break for the "quebra_pagina" section marker templates
  // can place in their config — a structural break, not rendered content.
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

  // Lays out photos in a `colunas`-wide grid, mirroring the "Layout de
  // fotos" columns the empresa picked in Configurações → Modelos de OS
  // (fotosGridColunas) instead of always stacking one photo per row.
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

export type GerarPdfOsInput = {
  osId: string;
  empresaId: string;
  modo: "os" | "orcamento";
};

export async function gerarPdfOs({ osId, empresaId, modo }: GerarPdfOsInput): Promise<Uint8Array> {
  const [
    { data: os, error: erroOs },
    { data: profile },
    { data: termo },
    { data: osConfig },
    { data: fotos },
    { data: templatesData },
  ] = await Promise.all([
    supabaseAdmin
      .from("ordens_servico")
      .select("*, clientes(nome, telefone)")
      .eq("id", osId)
      .eq("user_id", empresaId)
      .single(),
    supabaseAdmin
      .from("profiles")
      .select("loja, nome, cnpj_cpf, endereco, whatsapp, logo_url")
      .eq("id", empresaId)
      .maybeSingle(),
    supabaseAdmin
      .from("termos_garantia")
      .select("conteudo")
      .eq("user_id", empresaId)
      .eq("is_default", true)
      .maybeSingle(),

    supabaseAdmin
      .from("os_config" as any)
      .select("*")
      .eq("user_id", empresaId)
      .maybeSingle(),

    supabaseAdmin
      .from("service_order_photos" as any)
      .select("*")
      .eq("service_order_id", osId),

    // Empresa's chosen template (padrão first, otherwise any active one) —
    // same query ordens.tsx's imprimir() uses, so the WhatsApp PDF matches
    // whatever the empresa sees when printing from the browser.
    supabaseAdmin
      .from("os_templates" as any)
      .select("*")
      .eq("user_id", empresaId)
      .eq("ativo", true)
      .order("padrao", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1),
  ]);
  if (erroOs || !os) throw new Error("OS não encontrada para gerar o PDF.");

  const itens = await supabaseAdmin
    .from("os_itens" as any)
    .select("*")
    .eq("os_id", osId);

  const template =
    (((templatesData as any[]) ?? [])[0] as OsTemplateRow | undefined) ?? FALLBACK_TEMPLATE;
  const secoes = new Set<OsTemplateSecao>(secoesOrdenadas(template));
  const corTema = TEMA_RGB[template.tema];
  const corAccent = rgb(corTema.r, corTema.g, corTema.b);

  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Escritor(pdf, fonte, fonteNegrito, corAccent);

  const osAny = os as any;
  const profileAny = profile as any;
  const tituloDoc = modo === "orcamento" ? "Orçamento" : "Ordem de Serviço";

  // Company logo — the HTML template (imprimir()) shows it in the header;
  // this pdf-lib layout never fetched/embedded it at all before, which is
  // the main reason a themed template still looked unbranded here. A
  // fetch() failure (missing/unreachable logo_url) just skips the image
  // instead of failing the whole PDF.
  if (profileAny?.logo_url) {
    try {
      const resposta = await fetch(profileAny.logo_url);
      if (resposta.ok) {
        const bytesLogo = new Uint8Array(await resposta.arrayBuffer());
        const ehPng = (profileAny.logo_url as string).toLowerCase().includes(".png");
        await w.imagem(bytesLogo, ehPng, 120, 48);
        w.espaco(4);
      }
    } catch {
      // logo indisponível — segue sem travar a geração do PDF.
    }
  }

  w.titulo(`${profileAny?.loja || profileAny?.nome || "Assistência Técnica"}`, 16);
  w.subtitulo(`${tituloDoc} nº ${osAny.numero} — ${dataBR(osAny.created_at)}`, rgb(0.1, 0.1, 0.15));
  const infoEmpresa = [profileAny?.cnpj_cpf, profileAny?.endereco, profileAny?.whatsapp]
    .filter(Boolean)
    .join("  ·  ");
  if (infoEmpresa) w.paragrafo(infoEmpresa, 8, rgb(0.5, 0.5, 0.55));
  w.espaco(6);
  w.linhaDivisoria();

  const listaItens = (itens.data as any[]) ?? [];
  const checklist = (osAny.checklist_entrada ?? {}) as Record<string, string>;
  const estadoFisico = (osAny.estado_fisico ?? {}) as Record<string, boolean>;
  const fotosLista = (fotos as any[]) ?? [];
  const assinaturaCliente = fotosLista.find((f) => f.category === "assinatura_cliente");
  const assinaturaTecnico = fotosLista.find((f) => f.category === "assinatura_tecnico");

  // Sections are drawn in the exact order secoesOrdenadas(template) returns
  // — the same order the HTML template (imprimir()) respects — instead of
  // the old fixed sequence this function used to hardcode regardless of how
  // the empresa arranged "Configurações → Modelos de OS" (e.g. a template
  // that puts "valores" right after the header used to always render it
  // buried below the itens list here).
  for (const secaoAtual of secoesOrdenadas(template)) {
    if (!secoes.has(secaoAtual)) continue;
    switch (secaoAtual) {
      case "cabecalho":
        break; // já desenhado acima, junto com a logo.

      case "cliente":
        w.linhaCampo("Cliente", osAny.clientes?.nome ?? "—");
        w.linhaCampo("Telefone", osAny.clientes?.telefone ?? "—");
        break;

      case "aparelho":
        w.linhaCampo(
          "Aparelho",
          [osAny.aparelho, osAny.marca, osAny.modelo].filter(Boolean).join(" "),
        );
        break;

      case "defeito":
        w.linhaCampo("Defeito relatado", osAny.defeito ?? "—");
        break;

      case "diagnostico":
        w.linhaCampo("Diagnóstico", osAny.diagnostico ?? "—");
        break;

      case "garantia":
        w.linhaCampo(
          "Garantia",
          osAny.garantia_dias
            ? `${osAny.garantia_dias} dias${osAny.garantia_vencimento ? ` — válida até ${dataBR(osAny.garantia_vencimento)}` : ""}`
            : "—",
        );
        break;

      case "itens":
        if (listaItens.length) {
          w.subtitulo("Produtos e serviços");
          for (const item of listaItens) {
            const subtotal = Number(item.quantidade) * Number(item.preco_unitario);
            w.paragrafo(
              `${item.descricao} (${item.tipo === "servico" ? "Serviço" : "Produto"}) — ${item.quantidade}x ${brl(item.preco_unitario)} = ${brl(subtotal)}`,
            );
          }
          w.espaco(4);
        }
        break;

      case "valores":
        w.subtitulo(`Total: ${brl(osAny.valor)}`);
        w.espaco(10);
        break;

      case "checklist": {
        const preenchido = Object.keys(checklist).filter((k) => checklist[k]);
        if (preenchido.length) {
          w.subtitulo("Checklist de entrada");
          w.paragrafo(
            preenchido
              .map(
                (k) =>
                  `${CHECKLIST_LABELS[k] ?? k}: ${CHECKLIST_STATUS_LABELS[checklist[k]!] ?? checklist[k]}`,
              )
              .join("  •  "),
          );
          w.espaco(6);
        }
        break;
      }

      case "estado_fisico": {
        const marcado = Object.keys(estadoFisico).filter((k) => estadoFisico[k]);
        if (marcado.length || osAny.estado_fisico_obs) {
          w.subtitulo("Estado físico do aparelho");
          w.paragrafo(
            marcado.map((k) => ESTADO_FISICO_LABELS[k] ?? k).join(", ") || "Sem avarias marcadas.",
          );
          if (osAny.estado_fisico_obs) w.paragrafo(osAny.estado_fisico_obs, 9, rgb(0.4, 0.4, 0.45));
          w.espaco(6);
        }
        break;
      }

      case "termos":
        if (termo?.conteudo) {
          w.subtitulo("Termos de garantia");
          w.paragrafo(termo.conteudo, 8, rgb(0.35, 0.35, 0.4));
          w.espaco(6);
        }
        if ((osConfig as any)?.termos_condicoes) {
          w.subtitulo("Condições");
          w.paragrafo((osConfig as any).termos_condicoes, 8, rgb(0.35, 0.35, 0.4));
          w.espaco(6);
        }
        break;

      case "fotos": {
        const galeria = fotosLista.filter(
          (f) => f.category !== "assinatura_cliente" && f.category !== "assinatura_tecnico",
        );
        if (galeria.length) {
          const legenda = (cat: string) =>
            cat === "entrada" ? "Entrada" : cat === "durante" ? "Durante" : "Saída";
          const baixadas = (
            await Promise.all(
              galeria.map(async (f) => {
                const { data: arquivo } = await supabaseAdmin.storage
                  .from("os-fotos")
                  .download(f.url);
                if (!arquivo) return null;
                return {
                  bytes: new Uint8Array(await arquivo.arrayBuffer()),
                  ehPng: (f.url as string).toLowerCase().endsWith(".png"),
                  legenda: legenda(f.category),
                };
              }),
            )
          ).filter((f): f is NonNullable<typeof f> => f !== null);
          if (baixadas.length) {
            w.subtitulo("Fotos do equipamento");
            await w.imagensGrade(baixadas, fotosGridColunas(template.config.fotos_layout));
            w.espaco(4);
          }
        }
        break;
      }

      case "qrcode":
        // Sem gerador de QR raster server-side neste projeto (ver
        // comentário no topo do arquivo) — aceito na config do modelo mas
        // ainda não desenhado aqui.
        break;

      case "assinaturas":
        if (assinaturaCliente || assinaturaTecnico) {
          w.subtitulo("Assinaturas");
          for (const [rotulo, foto] of [
            ["Cliente", assinaturaCliente],
            ["Técnico", assinaturaTecnico],
          ] as const) {
            if (!foto) continue;
            const { data: arquivo } = await supabaseAdmin.storage
              .from("os-fotos")
              .download(foto.url);
            if (!arquivo) continue;
            const bytes = new Uint8Array(await arquivo.arrayBuffer());
            w.paragrafo(rotulo, 8, rgb(0.45, 0.45, 0.5));
            await w.imagem(bytes, foto.url.toLowerCase().endsWith(".png"), 180, 70);
          }
        }
        break;

      case "quebra_pagina":
        w.novaPagina();
        break;
    }
  }

  return pdf.save();
}

export async function salvarPdfOsNoStorage(
  params: GerarPdfOsInput,
): Promise<{ path: string; bytes: Uint8Array }> {
  const bytes = await gerarPdfOs(params);
  const nomeArquivo = params.modo === "orcamento" ? "orcamento" : "os";
  const path = `${params.empresaId}/${params.osId}/documentos/${nomeArquivo}-${Date.now()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from("os-fotos")
    .upload(path, bytes, { contentType: "application/pdf" });
  if (error) throw error;
  return { path, bytes };
}
