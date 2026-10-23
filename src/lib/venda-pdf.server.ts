// Comprovante de venda (PDV / Vendas) — qualquer venda, com todos os itens.
// O de aparelho (aparelho-pdf.server.ts) continua sendo o específico de
// venda de aparelho, com IMEI/garantia. Mesmo Escritor dos outros PDFs.
// Server-only: lê com supabaseAdmin, então quem chama precisa já ter
// confirmado que o usuário enxerga a venda (ver vendas.functions.ts).
import { rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMA_RGB } from "@/lib/os-template-render";
import { criarEscritor } from "@/lib/pdf-writer.server";

const COR = rgb(TEMA_RGB.roxo.r, TEMA_RGB.roxo.g, TEMA_RGB.roxo.b);
const CINZA = rgb(0.5, 0.5, 0.55);

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataHoraBR = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

export async function gerarPdfComprovanteVenda({
  vendaId,
  empresaId,
}: {
  vendaId: string;
  empresaId: string;
}): Promise<Uint8Array> {
  const [{ data: venda, error }, { data: itens }, { data: empresa }] = await Promise.all([
    supabaseAdmin
      .from("vendas")
      .select("*, clientes(nome, telefone, documento)")
      .eq("id", vendaId)
      .eq("user_id", empresaId)
      .single(),
    supabaseAdmin
      .from("venda_itens")
      .select("descricao, quantidade, preco_unitario")
      .eq("venda_id", vendaId)
      .eq("user_id", empresaId),
    supabaseAdmin
      .from("profiles")
      .select("loja, nome, cnpj_cpf, endereco, whatsapp, logo_url")
      .eq("id", empresaId)
      .maybeSingle(),
  ]);
  if (error || !venda) throw new Error("Venda não encontrada para gerar o comprovante.");

  const { pdf, w } = await criarEscritor(COR);
  const nomeLoja = empresa?.loja || empresa?.nome || "SPACE TECH";

  if (empresa?.logo_url) {
    try {
      const resposta = await fetch(empresa.logo_url);
      if (resposta.ok) {
        const bytes = new Uint8Array(await resposta.arrayBuffer());
        await w.imagem(bytes, empresa.logo_url.toLowerCase().includes(".png"), 120, 48);
        w.espaco(4);
      }
    } catch {
      // logo indisponível — segue sem ela.
    }
  }
  w.titulo(nomeLoja, 16);
  const infoEmpresa = [empresa?.cnpj_cpf, empresa?.endereco, empresa?.whatsapp]
    .filter(Boolean)
    .join("  ·  ");
  if (infoEmpresa) w.paragrafo(infoEmpresa, 8, CINZA);
  w.espaco(6);
  w.linhaDivisoria();

  w.subtitulo(
    `Comprovante de Venda nº ${String(venda.numero).padStart(4, "0")}`,
    rgb(0.1, 0.1, 0.15),
  );
  w.paragrafo(`Data: ${dataHoraBR(venda.created_at)}`, 8, CINZA);
  if (venda.status === "cancelado") w.paragrafo("VENDA CANCELADA", 10, rgb(0.8, 0.1, 0.1));
  w.espaco(4);

  w.subtitulo("Cliente");
  w.linhaCampo("Nome", venda.clientes?.nome ?? "Consumidor final");
  if (venda.clientes?.documento) w.linhaCampo("CPF/CNPJ", venda.clientes.documento);
  if (venda.clientes?.telefone) w.linhaCampo("Telefone", venda.clientes.telefone);

  w.subtitulo("Itens");
  let subtotal = 0;
  for (const item of itens ?? []) {
    const totalItem = Number(item.quantidade) * Number(item.preco_unitario);
    subtotal += totalItem;
    w.paragrafo(
      `${item.quantidade}x  ${item.descricao}  —  ${brl(item.preco_unitario)} un.  =  ${brl(totalItem)}`,
      9,
    );
  }
  if (!itens?.length) w.paragrafo("Sem itens registrados.", 9, CINZA);

  w.espaco(4);
  w.linhaDivisoria();
  w.linhaCampo("Subtotal", brl(subtotal));
  if (Number(venda.desconto ?? 0) > 0) w.linhaCampo("Desconto", `− ${brl(venda.desconto)}`);
  w.subtitulo(`Total: ${brl(venda.total)}`);
  w.linhaCampo("Pagamento", venda.forma_pagamento ?? "—");

  if (venda.observacoes) {
    w.subtitulo("Observações");
    w.paragrafo(venda.observacoes, 9, rgb(0.35, 0.35, 0.4));
  }

  w.espaco(16);
  w.paragrafo(`Obrigado pela preferência! — ${nomeLoja}`, 9, rgb(0.2, 0.2, 0.25));
  w.paragrafo("Este comprovante não é documento fiscal.", 7, CINZA);

  return pdf.save();
}
