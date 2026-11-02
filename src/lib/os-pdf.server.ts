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
import { dataHoraBR, statusLabel } from "@/lib/format";
import {
  FALLBACK_TEMPLATE,
  TEMA_RGB,
  fotosGridColunas,
  secoesOrdenadas,
  type OsTemplateRow,
  type OsTemplateSecao,
} from "@/lib/os-template-render";
import { Escritor } from "@/lib/pdf-writer.server";
import { linhaHorarioLoja } from "@/lib/horario-loja";

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
      .select("*, clientes(nome, telefone, documento, email)")
      .eq("id", osId)
      .eq("user_id", empresaId)
      .single(),
    supabaseAdmin
      .from("profiles")
      .select("loja, nome, cnpj_cpf, endereco, whatsapp, logo_url, horario_funcionamento")
      .eq("id", empresaId)
      .maybeSingle(),
    supabaseAdmin
      .from("termos_garantia")
      .select("conteudo")
      .eq("user_id", empresaId)
      .eq("is_default", true)
      .eq("ativo", true)
      .maybeSingle(),

    supabaseAdmin.from("os_config").select("*").eq("user_id", empresaId).maybeSingle(),

    supabaseAdmin.from("service_order_photos").select("*").eq("service_order_id", osId),

    // Empresa's chosen template (padrão first, otherwise any active one) —
    // same query ordens.tsx's imprimir() uses, so the WhatsApp PDF matches
    // whatever the empresa sees when printing from the browser.
    supabaseAdmin
      .from("os_templates")
      .select("*")
      .eq("user_id", empresaId)
      .eq("ativo", true)
      .order("padrao", { ascending: false })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(1),
  ]);
  if (erroOs || !os) throw new Error("OS não encontrada para gerar o PDF.");

  const itens = await supabaseAdmin.from("os_itens").select("*").eq("os_id", osId);

  const template = (templatesData?.[0] as OsTemplateRow | undefined) ?? FALLBACK_TEMPLATE;
  const secoes = new Set<OsTemplateSecao>(secoesOrdenadas(template));
  const corTema = TEMA_RGB[template.tema];
  const corAccent = rgb(corTema.r, corTema.g, corTema.b);

  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Escritor(pdf, fonte, fonteNegrito, corAccent);

  const ehOrcamento = modo === "orcamento";
  const tituloDoc = ehOrcamento ? "Orçamento" : "Ordem de Serviço";
  const nomeLoja = profile?.loja || profile?.nome || "Assistência Técnica";
  const origem = origemPublicaServer();
  const linkConsulta = origem ? `${origem}/consulta/${osId}` : null;
  // Orçamento ainda sem resposta do cliente: o PDF explica como aprovar e
  // leva o link/QR de aprovação, independente da chave do QR Code.
  const aguardandoResposta =
    ["recebido", "em_analise", "orcamento", "aguardando_aprovacao"].includes(os.status) &&
    (ehOrcamento || ["orcamento", "aguardando_aprovacao"].includes(os.status));

  // Logo da empresa: falha ao baixar só deixa o cabeçalho sem a imagem.
  let logo: { bytes: Uint8Array; ehPng: boolean } | null = null;
  if (profile?.logo_url) {
    try {
      const resposta = await fetch(profile.logo_url);
      if (resposta.ok) {
        logo = {
          bytes: new Uint8Array(await resposta.arrayBuffer()),
          ehPng: profile.logo_url.toLowerCase().includes(".png"),
        };
      }
    } catch {
      // logo indisponível — segue sem travar a geração do PDF.
    }
  }

  const horarioLoja = linhaHorarioLoja(profile?.horario_funcionamento);
  await w.cabecalhoDocumento({
    logo,
    loja: nomeLoja,
    linhasLoja: [
      profile?.cnpj_cpf ? `CNPJ/CPF: ${profile.cnpj_cpf}` : null,
      profile?.endereco ?? null,
      profile?.whatsapp ? `WhatsApp: ${profile.whatsapp}` : null,
      horarioLoja,
    ].filter((l): l is string => !!l),
    documento: tituloDoc,
    numero: `Nº ${os.numero}`,
    data: `Aberta em ${dataHoraBR(os.created_at)}`,
    status: statusLabel(os.status),
  });

  // Explicação da situação, para o cliente entender o documento de cara.
  const situacao = explicarSituacao(os.status, ehOrcamento, {
    garantiaAte: os.garantia_vencimento ? dataBR(os.garantia_vencimento) : null,
    horario: horarioLoja,
  });
  if (situacao) w.aviso(situacao.titulo, situacao.texto, situacao.tom);

  const listaItens = itens.data ?? [];
  const checklist = (os.checklist_entrada ?? {}) as Record<string, string>;
  const estadoFisico = (os.estado_fisico ?? {}) as Record<string, boolean>;
  const fotosLista = fotos ?? [];
  const assinaturaCliente = fotosLista.find((f) => f.category === "assinatura_cliente");
  const assinaturaTecnico = fotosLista.find((f) => f.category === "assinatura_tecnico");
  const cliente = os.clientes as {
    nome?: string | null;
    telefone?: string | null;
    documento?: string | null;
    email?: string | null;
  } | null;
  let qrJaDesenhado = false;

  async function baixarImagem(path: string) {
    const { data: arquivo } = await supabaseAdmin.storage.from("os-fotos").download(path);
    if (!arquivo) return null;
    return {
      bytes: new Uint8Array(await arquivo.arrayBuffer()),
      ehPng: path.toLowerCase().endsWith(".png"),
    };
  }

  async function qrPng(url: string) {
    try {
      return new Uint8Array(await QRCode.toBuffer(url, { type: "png", margin: 1, width: 240 }));
    } catch {
      return null;
    }
  }

  // Seções na ordem do modelo escolhido em Configurações → Modelos de OS
  // (a mesma da impressão), cada uma com título e layout próprios.
  // O bloco "aprove ou recuse" entra logo depois do que vier por último entre
  // serviços e valores — o cliente decide depois de ver o que vai pagar.
  const ordem = secoesOrdenadas(template);
  const depoisDe = Math.max(ordem.indexOf("itens"), ordem.indexOf("valores"));

  for (const [indice, secaoAtual] of ordem.entries()) {
    if (!secoes.has(secaoAtual)) continue;
    switch (secaoAtual) {
      case "cabecalho":
        break; // já desenhado acima.

      case "cliente":
        w.secao("Dados do cliente");
        w.grade([
          ["Nome", cliente?.nome ?? "Não informado"],
          ["Telefone / WhatsApp", cliente?.telefone ?? ""],
          ["CPF / CNPJ", cliente?.documento ?? ""],
          ["E-mail", cliente?.email ?? ""],
        ]);
        break;

      case "aparelho":
        w.secao("Dados do aparelho");
        w.grade([
          ["Aparelho", [os.aparelho, os.marca, os.modelo].filter(Boolean).join(" ") || "—"],
          ["Cor", os.cor ?? ""],
          ["IMEI", os.imei ?? ""],
          ["Número de série", os.serial_number ?? ""],
          ["Senha (PIN)", os.senha_dispositivo ?? ""],
          [
            "Padrão de desbloqueio",
            os.padrao_desbloqueio ? `Sequência ${os.padrao_desbloqueio}` : "",
          ],
        ]);
        break;

      case "defeito":
        if (os.defeito) {
          w.secao("Defeito relatado pelo cliente");
          w.paragrafo(os.defeito, 9.5);
        }
        break;

      case "diagnostico":
        if (os.diagnostico) {
          w.secao("Diagnóstico técnico");
          w.paragrafo(os.diagnostico, 9.5);
        }
        break;

      case "checklist": {
        const preenchido = Object.keys(checklist).filter((k) => checklist[k]);
        if (preenchido.length) {
          w.secao("Testes feitos na entrada");
          w.grade(
            preenchido.map((k) => [
              CHECKLIST_LABELS[k] ?? k,
              CHECKLIST_STATUS_LABELS[checklist[k]!] ?? checklist[k]!,
            ]),
            4,
          );
        }
        break;
      }

      case "estado_fisico": {
        const marcado = Object.keys(estadoFisico).filter((k) => estadoFisico[k]);
        if (marcado.length || os.estado_fisico_obs || os.acessorios) {
          w.secao("Estado do aparelho na entrada");
          w.grade(
            [
              [
                "Avarias encontradas",
                marcado.map((k) => ESTADO_FISICO_LABELS[k] ?? k).join(", ") ||
                  "Nenhuma avaria visível",
              ],
              ["Observações", os.estado_fisico_obs ?? ""],
              ["Acessórios deixados", os.acessorios ?? ""],
            ],
            1,
          );
          w.paragrafo(
            "Registro das condições em que o aparelho foi recebido pela loja.",
            7.5,
            rgb(0.5, 0.5, 0.56),
          );
        }
        break;
      }

      case "itens":
        if (listaItens.length) {
          w.secao(ehOrcamento ? "Serviços e peças do orçamento" : "Serviços e peças");
          w.tabela(
            [
              { titulo: "Descrição", largura: 46 },
              { titulo: "Tipo", largura: 13 },
              { titulo: "Qtd", largura: 8, direita: true },
              { titulo: "Valor unit.", largura: 16, direita: true },
              { titulo: "Total", largura: 17, direita: true },
            ],
            listaItens.map((item) => [
              item.descricao,
              item.tipo === "servico" ? "Serviço" : "Peça",
              String(item.quantidade),
              brl(item.preco_unitario),
              brl(Number(item.quantidade) * Number(item.preco_unitario)),
            ]),
          );
        }
        break;

      case "valores": {
        const subtotal = listaItens.reduce(
          (s, i) => s + Number(i.quantidade) * Number(i.preco_unitario),
          0,
        );
        const desconto = Number(os.desconto ?? 0);
        const total = Number(os.valor ?? 0);
        const ajuste = listaItens.length ? total - (subtotal - desconto) : 0;
        const linhas: [string, string][] = [];
        if (listaItens.length) linhas.push(["Subtotal", brl(subtotal)]);
        if (desconto > 0) linhas.push(["Desconto", `- ${brl(desconto)}`]);
        if (Math.abs(ajuste) >= 0.01) linhas.push(["Outros valores", brl(ajuste)]);
        const pago = Number(os.valor_pago ?? 0);
        if (!ehOrcamento && pago > 0) {
          linhas.push(["Já pago", brl(pago)]);
          linhas.push(["Falta pagar", brl(Math.max(0, total - pago))]);
        }
        w.totais(linhas, [ehOrcamento ? "Total do orçamento" : "Total", brl(total)]);
        break;
      }

      case "garantia":
        // Garantia só se aplica a um serviço já executado — num orçamento
        // ainda não há o que garantir.
        if (!ehOrcamento) {
          w.secao("Garantia");
          w.grade([
            ["Prazo", os.garantia_dias ? `${os.garantia_dias} dias` : "Não informado"],
            [
              "Válida até",
              os.garantia_vencimento
                ? dataBR(os.garantia_vencimento)
                : os.garantia_dias
                  ? "Conta a partir da entrega do aparelho"
                  : "",
            ],
          ]);
        }
        break;

      case "termos":
        if (!ehOrcamento && (termo?.conteudo || osConfig?.termos_condicoes)) {
          w.secao("Termos e condições");
          if (termo?.conteudo) {
            w.paragrafo(textoParaPdf(termo.conteudo), 7.5, rgb(0.3, 0.3, 0.36));
            w.espaco(4);
          }
          if (osConfig?.termos_condicoes) {
            w.paragrafo(textoParaPdf(osConfig.termos_condicoes), 7.5, rgb(0.3, 0.3, 0.36));
          }
        }
        break;

      case "fotos": {
        // Mesma regra da impressão (ordens.tsx imprimir()): fotos só saem com
        // "Exibir fotos na impressão" ligado em Configurações → OS.
        if (!osConfig?.exibir_fotos_impressao) break;
        const galeria = fotosLista.filter(
          (f) => f.category !== "assinatura_cliente" && f.category !== "assinatura_tecnico",
        );
        if (galeria.length) {
          const legenda = (cat: string | null) =>
            cat === "entrada" ? "Entrada" : cat === "durante" ? "Durante" : "Saída";
          const baixadas = (
            await Promise.all(
              galeria.map(async (f) => {
                const img = await baixarImagem(f.url as string);
                return img ? { ...img, legenda: legenda(f.category) } : null;
              }),
            )
          ).filter((f): f is NonNullable<typeof f> => f !== null);
          if (baixadas.length) {
            w.secao("Fotos do aparelho");
            await w.imagensGrade(baixadas, fotosGridColunas(template.config.fotos_layout));
          }
        }
        break;
      }

      case "qrcode": {
        if (qrJaDesenhado || !osConfig?.imprimir_qrcode_cliente || !linkConsulta) break;
        const png = await qrPng(linkConsulta);
        if (png) {
          await w.qrComTexto(
            png,
            "Acompanhe seu atendimento online",
            `Aponte a câmera do celular para o QR Code ou acesse ${linkConsulta} para ver a situação do seu aparelho a qualquer momento.`,
          );
        }
        break;
      }

      case "assinaturas": {
        const [imgCliente, imgTecnico] = await Promise.all([
          assinaturaCliente ? baixarImagem(assinaturaCliente.url) : null,
          assinaturaTecnico ? baixarImagem(assinaturaTecnico.url) : null,
        ]);
        w.secao("Assinaturas");
        await w.assinaturas([
          { rotulo: "Cliente", nome: cliente?.nome ?? null, imagem: imgCliente },
          { rotulo: nomeLoja, nome: os.responsavel ?? null, imagem: imgTecnico },
        ]);
        break;
      }

      case "quebra_pagina":
        w.novaPagina();
        break;
    }

    if (indice === depoisDe && aguardandoResposta && linkConsulta) {
      const png = await qrPng(linkConsulta);
      if (png) {
        await w.qrComTexto(
          png,
          "Aprove ou recuse este orçamento",
          `Aponte a câmera do celular para o QR Code ou acesse ${linkConsulta} — lá você vê os serviços e toca em Aprovar ou Recusar. Se preferir, responda pelo WhatsApp da loja.`,
        );
        qrJaDesenhado = true;
      }
    }
  }

  w.rodape(
    [
      nomeLoja,
      profile?.whatsapp ? `WhatsApp ${profile.whatsapp}` : null,
      `${tituloDoc} nº ${os.numero}`,
      `Emitido em ${dataHoraBR(new Date().toISOString())}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
  );

  return pdf.save();
}

/**
 * Termos digitados com emoji (✅ ❌ ⚠️ 📱...) e separadores "---": a fonte do
 * PDF não tem emoji (viravam "[OK]", "[X]"...), então saem sem eles.
 */
function textoParaPdf(texto: string): string {
  return texto
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .split(/\r?\n/)
    .map((l) => (/^\s*-{3,}\s*$/.test(l) ? "" : l.replace(/^\s+/, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** Texto curto que explica ao cliente em que pé está o atendimento. */
function explicarSituacao(
  status: string,
  ehOrcamento: boolean,
  extra: { garantiaAte: string | null; horario: string | null },
): { titulo: string; texto: string; tom: "accent" | "verde" | "amarelo" } | null {
  if (
    ehOrcamento &&
    ["recebido", "em_analise", "orcamento", "aguardando_aprovacao"].includes(status)
  )
    return {
      titulo: "Este documento é um orçamento",
      texto:
        "Nenhum serviço será feito sem a sua autorização. Confira abaixo os serviços, as peças e os valores. Para seguir com o conserto, é só aprovar o orçamento pelo link ou QR Code logo abaixo dos valores.",
      tom: "accent",
    };
  switch (status) {
    case "recebido":
    case "em_analise":
      return {
        titulo: "Seu aparelho está em análise",
        texto:
          "Recebemos o seu aparelho e ele está passando pela avaliação técnica. Assim que o diagnóstico ficar pronto, enviaremos o orçamento para a sua aprovação — nada é feito sem o seu OK.",
        tom: "accent",
      };
    case "orcamento":
    case "aguardando_aprovacao":
      return {
        titulo: "Aguardando a sua aprovação",
        texto:
          "O orçamento do conserto está pronto e o serviço só começa depois que você aprovar. Confira os valores abaixo e use o link ou QR Code deste documento para aprovar ou recusar.",
        tom: "amarelo",
      };
    case "aprovado":
    case "em_reparo":
      return {
        titulo: "Orçamento aprovado — conserto em andamento",
        texto:
          "Obrigado pela confiança! Seu aparelho está em reparo. Avisaremos pelo WhatsApp assim que ele estiver pronto para retirada.",
        tom: "accent",
      };
    case "aguardando_peca":
      return {
        titulo: "Aguardando a chegada da peça",
        texto:
          "A peça necessária para o conserto já foi solicitada. Assim que ela chegar, o reparo continua e avisaremos você.",
        tom: "amarelo",
      };
    case "pronto":
      return {
        titulo: "Seu aparelho está pronto!",
        texto: `Pode vir retirar o seu aparelho${extra.horario ? ` (${extra.horario.replace(/^Horário: /, "horário: ")})` : ""}. Informe o número desta OS na retirada.`,
        tom: "verde",
      };
    case "entregue":
    case "faturado":
      return {
        titulo: "Serviço concluído e aparelho entregue",
        texto: `Guarde este documento: ele é o seu comprovante do serviço e da garantia${extra.garantiaAte ? `, válida até ${extra.garantiaAte}` : ""}.`,
        tom: "verde",
      };
    case "reprovado":
      return {
        titulo: "Orçamento não aprovado",
        texto:
          "O orçamento não foi aprovado, então o serviço não foi realizado. Se mudar de ideia ou tiver dúvidas, fale com a loja.",
        tom: "amarelo",
      };
    case "cancelado":
      return {
        titulo: "Ordem de serviço cancelada",
        texto: "Este atendimento foi cancelado. Em caso de dúvidas, fale com a loja.",
        tom: "amarelo",
      };
    default:
      return null;
  }
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
