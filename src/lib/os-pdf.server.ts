// Generates an actual PDF file (not just the client-side print popup HTML
// ordens.tsx's imprimir() uses) for a service order, so it can be attached
// to a WhatsApp notification. Server-only: uses supabaseAdmin to read
// across tables regardless of the caller's RLS session and to download
// signature/gallery images straight from storage (no signed URL round-trip
// needed server-side). Respects the empresa's selected "Modelos de OS"
// template the same way ordens.tsx's imprimir() does — theme color, which
// sections to include and in what order, and the photo grid layout — just
// laid out with pdf-lib instead of HTML. The QR code is rendered with the
// `qrcode` package (raster PNG, unlike qrcode.react which only renders SVG
// in the browser) and encodes the same "/consulta/:id" public link as the
// HTML template — see origemPublicaServer() below for why this reads
// VITE_SITE_URL from process.env instead of site-url.ts's origemPublica().
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  FALLBACK_TEMPLATE,
  TEMA_RGB,
  fotosGridColunas,
  secoesOrdenadas,
  type OsTemplateRow,
  type OsTemplateSecao,
} from "@/lib/os-template-render";
import { Escritor } from "@/lib/pdf-writer.server";

// site-url.ts's origemPublica() falls back to window.location.origin, which
// doesn't exist in this server context — read the same VITE_SITE_URL env var
// directly instead. VITE_-prefixed vars in this project are only injected
// into import.meta.env, never into process.env (verified against the
// running dev process: process.env has none of them, even though this file
// previously read it that way — the QR code below silently never rendered
// because of it, since it no-ops when origem is empty). client.ts:33 already
// reads VITE_SUPABASE_URL the same way this now does.
function origemPublicaServer(): string {
  return import.meta.env["VITE_SITE_URL"] ?? "";
}

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
        if (osAny.cor) w.linhaCampo("Cor", osAny.cor);
        if (osAny.imei) w.linhaCampo("IMEI", osAny.imei);
        if (osAny.serial_number) w.linhaCampo("Número de série", osAny.serial_number);
        w.linhaCampo("Senha (PIN)", osAny.senha_dispositivo || "—");
        w.linhaCampo(
          "Padrão",
          osAny.padrao_desbloqueio ? `Sequência: ${osAny.padrao_desbloqueio}` : "—",
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
        if (Number(osAny.desconto ?? 0) > 0) {
          w.paragrafo(`Desconto: ${brl(osAny.desconto)}`, 9, rgb(0.4, 0.4, 0.45));
        }
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

      case "qrcode": {
        const origem = origemPublicaServer();
        if (!(osConfig as any)?.imprimir_qrcode_cliente || !origem) break;
        try {
          const png = await QRCode.toBuffer(`${origem}/consulta/${osId}`, {
            type: "png",
            margin: 1,
            width: 200,
          });
          await w.imagem(new Uint8Array(png), true, 100, 100);
          w.paragrafo("Acompanhe sua OS online", 8, rgb(0.5, 0.5, 0.55));
          w.espaco(4);
        } catch {
          // QR indisponível — segue sem travar a geração do PDF.
        }
        break;
      }

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
