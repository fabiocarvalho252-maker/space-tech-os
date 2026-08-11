// Generates an actual PDF file (not just the client-side print popup HTML
// ordens.tsx's imprimir() uses) for a service order, so it can be attached
// to a WhatsApp notification. Server-only: uses supabaseAdmin to read
// across tables regardless of the caller's RLS session and to download
// signature images straight from storage (no signed URL round-trip needed
// server-side). Mirrors the same content imprimir() already prints —
// cliente, aparelho, defeito/diagnóstico, itens, garantia, termo, checklist,
// estado físico, assinaturas — just laid out with pdf-lib instead of HTML.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

const MARGEM = 48;
const LARGURA_PAGINA = 595.28; // A4 pt
const ALTURA_PAGINA = 841.89;
const LARGURA_UTIL = LARGURA_PAGINA - MARGEM * 2;

class Escritor {
  private pdf: PDFDocument;
  private fonte: PDFFont;
  private fonteNegrito: PDFFont;
  private pagina: PDFPage;
  private y: number;

  constructor(pdf: PDFDocument, fonte: PDFFont, fonteNegrito: PDFFont) {
    this.pdf = pdf;
    this.fonte = fonte;
    this.fonteNegrito = fonteNegrito;
    this.pagina = pdf.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
    this.y = ALTURA_PAGINA - MARGEM;
  }

  private quebrarLinha() {
    this.pagina = this.pdf.addPage([LARGURA_PAGINA, ALTURA_PAGINA]);
    this.y = ALTURA_PAGINA - MARGEM;
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
    this.pagina.drawText(texto, {
      x: MARGEM,
      y: this.y,
      size: tamanho,
      font: this.fonteNegrito,
      color: rgb(0.31, 0.27, 0.9),
    });
    this.y -= tamanho + 8;
  }

  subtitulo(texto: string) {
    this.garantirEspaco(16);
    this.pagina.drawText(texto, {
      x: MARGEM,
      y: this.y,
      size: 11,
      font: this.fonteNegrito,
      color: rgb(0.1, 0.1, 0.15),
    });
    this.y -= 16;
  }

  paragrafo(texto: string, tamanho = 9, cor = rgb(0.2, 0.2, 0.25)) {
    const linhas = this.quebrarTexto(texto, this.fonte, tamanho, LARGURA_UTIL);
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
    this.pagina.drawText(rotulo, {
      x: MARGEM,
      y: this.y,
      size: 9,
      font: this.fonteNegrito,
      color: rgb(0.45, 0.45, 0.5),
    });
    const linhas = this.quebrarTexto(valor || "—", this.fonte, 9, LARGURA_UTIL - 130);
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
  ] = await Promise.all([
    supabaseAdmin
      .from("ordens_servico")
      .select("*, clientes(nome, telefone)")
      .eq("id", osId)
      .eq("user_id", empresaId)
      .single(),
    supabaseAdmin.from("profiles").select("loja").eq("id", empresaId).maybeSingle(),
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
  ]);
  if (erroOs || !os) throw new Error("OS não encontrada para gerar o PDF.");

  const itens = await supabaseAdmin
    .from("os_itens" as any)
    .select("*")
    .eq("os_id", osId);

  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Escritor(pdf, fonte, fonteNegrito);

  const osAny = os as any;
  const tituloDoc = modo === "orcamento" ? "Orçamento" : "Ordem de Serviço";

  w.titulo(`${(profile as any)?.loja ?? "Assistência Técnica"}`, 16);
  w.subtitulo(`${tituloDoc} nº ${osAny.numero} — ${dataBR(osAny.created_at)}`);
  w.espaco(6);
  w.linhaDivisoria();

  w.linhaCampo("Cliente", osAny.clientes?.nome ?? "—");
  w.linhaCampo("Telefone", osAny.clientes?.telefone ?? "—");
  w.linhaCampo("Aparelho", [osAny.aparelho, osAny.marca, osAny.modelo].filter(Boolean).join(" "));
  w.linhaCampo("Defeito relatado", osAny.defeito ?? "—");
  w.linhaCampo("Diagnóstico", osAny.diagnostico ?? "—");
  w.linhaCampo(
    "Garantia",
    osAny.garantia_dias
      ? `${osAny.garantia_dias} dias${osAny.garantia_vencimento ? ` — válida até ${dataBR(osAny.garantia_vencimento)}` : ""}`
      : "—",
  );
  w.espaco(6);

  const listaItens = (itens.data as any[]) ?? [];
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

  w.subtitulo(`Total: ${brl(osAny.valor)}`);
  w.espaco(10);

  const checklist = (osAny.checklist_entrada ?? {}) as Record<string, string>;
  const checklistPreenchido = Object.keys(checklist).filter((k) => checklist[k]);
  if (checklistPreenchido.length) {
    w.subtitulo("Checklist de entrada");
    w.paragrafo(
      checklistPreenchido
        .map(
          (k) =>
            `${CHECKLIST_LABELS[k] ?? k}: ${CHECKLIST_STATUS_LABELS[checklist[k]!] ?? checklist[k]}`,
        )
        .join("  •  "),
    );
    w.espaco(6);
  }

  const estadoFisico = (osAny.estado_fisico ?? {}) as Record<string, boolean>;
  const estadoFisicoMarcado = Object.keys(estadoFisico).filter((k) => estadoFisico[k]);
  if (estadoFisicoMarcado.length || osAny.estado_fisico_obs) {
    w.subtitulo("Estado físico do aparelho");
    w.paragrafo(
      estadoFisicoMarcado.map((k) => ESTADO_FISICO_LABELS[k] ?? k).join(", ") ||
        "Sem avarias marcadas.",
    );
    if (osAny.estado_fisico_obs) w.paragrafo(osAny.estado_fisico_obs, 9, rgb(0.4, 0.4, 0.45));
    w.espaco(6);
  }

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

  const fotosLista = (fotos as any[]) ?? [];
  const assinaturaCliente = fotosLista.find((f) => f.category === "assinatura_cliente");
  const assinaturaTecnico = fotosLista.find((f) => f.category === "assinatura_tecnico");
  if (assinaturaCliente || assinaturaTecnico) {
    w.subtitulo("Assinaturas");
    for (const [rotulo, foto] of [
      ["Cliente", assinaturaCliente],
      ["Técnico", assinaturaTecnico],
    ] as const) {
      if (!foto) continue;
      const { data: arquivo } = await supabaseAdmin.storage.from("os-fotos").download(foto.url);
      if (!arquivo) continue;
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      w.paragrafo(rotulo, 8, rgb(0.45, 0.45, 0.5));
      await w.imagem(bytes, foto.url.toLowerCase().endsWith(".png"), 180, 70);
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
