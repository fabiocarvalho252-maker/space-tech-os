// Comprovante de compra de aparelho seminovo (pedido do usuário, seção 11)
// — reaproveita o mesmo Escritor de pdf-writer.server.ts que
// aparelho-pdf.server.ts/os-pdf.server.ts já usam, em vez de montar um
// terceiro motor de layout de PDF. Não existia nenhum gerador de PDF para
// COMPRA de seminovos até aqui (só para venda de aparelhos), então este é
// um arquivo novo — mas a receita (Escritor, supabaseAdmin, empresa no
// cabeçalho) é a mesma dos outros dois.
import { rgb } from "pdf-lib";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMA_RGB } from "@/lib/os-template-render";
import { criarEscritor } from "@/lib/pdf-writer.server";

const CORREGIONAL = rgb(TEMA_RGB.roxo.r, TEMA_RGB.roxo.g, TEMA_RGB.roxo.b);

const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
const dataBR = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleDateString("pt-BR") : "—";

async function carregarEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("loja, nome, cnpj_cpf, endereco, whatsapp, logo_url")
    .eq("id", empresaId)
    .maybeSingle();
  return data;
}

export type GerarComprovanteSeminovoInput = { seminovoId: string; empresaId: string };

export async function gerarPdfComprovanteSeminovo({
  seminovoId,
  empresaId,
}: GerarComprovanteSeminovoInput): Promise<Uint8Array> {
  const { data: seminovo, error } = await supabaseAdmin
    .from("seminovos")
    .select("*, cliente:clientes(nome, telefone, documento)")
    .eq("id", seminovoId)
    .eq("user_id", empresaId)
    .single();
  if (error || !seminovo) throw new Error("Registro de compra não encontrado.");

  const empresa = await carregarEmpresa(empresaId);

  const { pdf, w } = await criarEscritor(CORREGIONAL);

  w.titulo(empresa?.loja || empresa?.nome || "SPACE TECH", 16);
  const infoEmpresa = [empresa?.cnpj_cpf, empresa?.endereco, empresa?.whatsapp]
    .filter(Boolean)
    .join("  ·  ");
  if (infoEmpresa) w.paragrafo(infoEmpresa, 8, rgb(0.5, 0.5, 0.55));
  w.espaco(6);
  w.linhaDivisoria();

  w.subtitulo("Comprovante de Compra de Aparelho Seminovo", rgb(0.1, 0.1, 0.15));
  w.paragrafo(`Data da compra: ${dataBR(seminovo.data_avaliacao)}`, 8, rgb(0.5, 0.5, 0.55));
  w.espaco(8);

  const nomeVendedor = seminovo.cliente?.nome ?? seminovo.vendedor_nome ?? "—";
  const telefoneVendedor = seminovo.cliente?.telefone ?? seminovo.vendedor_telefone ?? "—";
  const documentoVendedor = seminovo.vendedor_documento ?? seminovo.cliente?.documento ?? null;

  w.subtitulo("Dados do vendedor");
  w.linhaCampo("Nome", nomeVendedor);
  w.linhaCampo("CPF", documentoVendedor ?? "—");
  w.linhaCampo("Telefone", telefoneVendedor);
  w.espaco(6);

  w.subtitulo("Dados do aparelho");
  w.linhaCampo("Marca / Modelo", `${seminovo.marca} ${seminovo.modelo}`);
  w.linhaCampo("Armazenamento", seminovo.armazenamento ?? "—");
  w.linhaCampo("Cor", seminovo.cor ?? "—");
  w.linhaCampo(
    "Bateria",
    seminovo.bateria_percentual != null ? `${seminovo.bateria_percentual}%` : "—",
  );
  if (seminovo.observacoes) w.linhaCampo("Observações", seminovo.observacoes);
  w.espaco(6);

  w.subtitulo("Valores");
  w.linhaCampo("Valor pago pelo aparelho", brl(seminovo.valor_pago));
  w.linhaCampo("Custos de conserto", brl(seminovo.valor_conserto));
  w.linhaCampo("Outros custos", brl(seminovo.outros_custos));
  w.subtitulo(`Custo total: ${brl(seminovo.valor_total_gasto)}`, rgb(0.1, 0.1, 0.15));
  w.espaco(6);

  w.subtitulo("Responsável pela compra");
  w.linhaCampo("Loja", empresa?.loja || empresa?.nome || "SPACE TECH");
  w.espaco(10);

  w.subtitulo("Declaração");
  w.paragrafo(
    "Declaro, na qualidade de vendedor, ter recebido o valor acima pelo aparelho descrito, " +
      "de livre e espontânea vontade, não havendo nada mais a reclamar sobre esta transação.",
    9,
    rgb(0.35, 0.35, 0.4),
  );
  w.espaco(10);

  if (seminovo.assinatura_url) {
    const { data: assinaturaBytes } = await supabaseAdmin.storage
      .from("seminovos-fotos")
      .download(seminovo.assinatura_url);
    if (assinaturaBytes) {
      w.subtitulo("Assinatura do vendedor", rgb(0.35, 0.35, 0.4));
      await w.imagem(new Uint8Array(await assinaturaBytes.arrayBuffer()), true, 220, 80);
    }
  } else {
    w.espaco(20);
    w.linhaDivisoria();
    w.espaco(6);
    w.paragrafo("________________________________", 9);
  }
  w.paragrafo(nomeVendedor, 8, rgb(0.5, 0.5, 0.55));

  return pdf.save();
}
