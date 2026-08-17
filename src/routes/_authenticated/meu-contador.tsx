import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format, startOfMonth } from "date-fns";
import { Calculator, FileArchive, FileText, Package, Receipt, ShoppingCart } from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useProfile } from "@/hooks/useCurrentUser";
import { brl, dataBR } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/meu-contador")({
  head: () => ({
    meta: [
      { title: "Meu Contador — SpaceTech" },
      {
        name: "description",
        content: "Resumo fiscal por período, com exportação de XMLs e PDF para o contador.",
      },
    ],
  }),
  component: MeuContador,
});

function hojeStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function MeuContador() {
  const { formatFinancialValue: fmt } = useFinancialVisibility();
  const { data: profile } = useProfile();
  const [dataInicioInput, setDataInicioInput] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [dataFimInput, setDataFimInput] = useState(hojeStr());
  const [filtro, setFiltro] = useState({ inicio: dataInicioInput, fim: dataFimInput });

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas-fiscais-contador", filtro.inicio, filtro.fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select(
          "id, numero, serie, chave_acesso, valor_total, status, created_at, emitida_em, venda_id, os_id, cliente:clientes(nome, documento)",
        )
        .eq("status", "emitida")
        .gte("created_at", new Date(`${filtro.inicio}T00:00:00`).toISOString())
        .lte("created_at", new Date(`${filtro.fim}T23:59:59.999`).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Não há coluna de tipo fiscal (NF-e/NFC-e/NFS-e) na tabela: a origem
  // (venda vs OS) já registrada define produto vs serviço, igual ao resumo
  // usado em Notas Fiscais. Dentro de "produto", o documento do cliente
  // (CNPJ = 14 dígitos → venda para empresa/NF-e, senão CPF/consumidor final
  // → NFC-e) é a mesma distinção usada no varejo brasileiro.
  const notasProdutos = notas.filter((n) => !!n.venda_id);
  const notasServicos = notas.filter((n) => !!n.os_id);
  const notasNfe = notasProdutos.filter(
    (n) => (n.cliente?.documento ?? "").replace(/\D/g, "").length === 14,
  );
  const notasNfce = notasProdutos.filter(
    (n) => (n.cliente?.documento ?? "").replace(/\D/g, "").length !== 14,
  );

  const totalFaturado = notas.reduce((s, n) => s + Number(n.valor_total), 0);
  const totalNfe = notasNfe.reduce((s, n) => s + Number(n.valor_total), 0);
  const totalNfce = notasNfce.reduce((s, n) => s + Number(n.valor_total), 0);
  const totalServicos = notasServicos.reduce((s, n) => s + Number(n.valor_total), 0);

  function filtrar() {
    setFiltro({ inicio: dataInicioInput, fim: dataFimInput });
  }

  async function exportarZip() {
    if (notas.length === 0) {
      toast.error("Nenhuma nota autorizada no período selecionado.");
      return;
    }
    const zip = new JSZip();
    notas.forEach((n) => {
      const tipo = n.venda_id
        ? (n.cliente?.documento ?? "").replace(/\D/g, "").length === 14
          ? "NFE"
          : "NFCE"
        : "NFSE";
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<notaControleInterno>
  <!-- Documento de controle interno SpaceTech — NÃO possui validade fiscal perante a SEFAZ. -->
  <tipo>${tipo}</tipo>
  <numero>${n.numero}</numero>
  <serie>${n.serie}</serie>
  <chaveAcesso>${n.chave_acesso ?? ""}</chaveAcesso>
  <dataEmissao>${n.emitida_em ?? n.created_at}</dataEmissao>
  <cliente>${n.cliente?.nome ?? ""}</cliente>
  <documentoCliente>${n.cliente?.documento ?? ""}</documentoCliente>
  <valorTotal>${Number(n.valor_total).toFixed(2)}</valorTotal>
</notaControleInterno>`;
      zip.file(`${tipo}_${n.serie}-${n.numero}.xml`, xml);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `notas-${filtro.inicio}_a_${filtro.fim}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${notas.length} XML(s) exportado(s) em .zip.`);
  }

  function exportarPdf() {
    const janela = window.open("", "_blank", "width=800,height=900");
    if (!janela) {
      toast.error("Não foi possível abrir a janela de impressão.", {
        description: "Verifique se o navegador está bloqueando pop-ups para este site.",
      });
      return;
    }
    janela.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Resumo Fiscal — ${profile?.loja || "SpaceTech"}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #333; }
          header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          h1 { margin: 0; color: #1e1b4b; font-size: 20px; }
          .aviso { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 20px; }
          .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
          .card { padding: 14px; border: 1px solid #ddd; border-radius: 8px; }
          .label { font-size: 11px; color: #666; text-transform: uppercase; }
          .valor { font-size: 16px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { text-align: left; background: #f3f4f6; padding: 8px; border-bottom: 2px solid #ddd; font-size: 12px; }
          td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${profile?.loja || "SpaceTech"}</h1>
            <p>Resumo Fiscal — ${dataBR(filtro.inicio)} a ${dataBR(filtro.fim)}</p>
          </div>
          <button class="no-print" onclick="window.print()">Imprimir PDF</button>
        </header>
        <div class="aviso">
          Resumo de controle interno gerado a partir das notas registradas no sistema —
          não substitui a apuração fiscal oficial junto ao seu contador.
        </div>
        <div class="resumo">
          <div class="card"><div class="label">Total faturado</div><div class="valor">${brl(totalFaturado)}</div></div>
          <div class="card"><div class="label">NF-e Produtos</div><div class="valor">${brl(totalNfe)}</div></div>
          <div class="card"><div class="label">NFC-e Consumidor</div><div class="valor">${brl(totalNfce)}</div></div>
          <div class="card"><div class="label">NFS-e Serviços</div><div class="valor">${brl(totalServicos)}</div></div>
        </div>
        <table>
          <thead><tr><th>Nº</th><th>Série</th><th>Data</th><th>Cliente</th><th>Valor</th></tr></thead>
          <tbody>
            ${notas
              .map(
                (n) => `<tr>
                  <td>${n.numero}</td>
                  <td>${n.serie}</td>
                  <td>${dataBR(n.emitida_em ?? n.created_at)}</td>
                  <td>${n.cliente?.nome ?? "—"}</td>
                  <td>${brl(n.valor_total)}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `);
    janela.document.close();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu Contador"
        subtitle="Resumo fiscal por período para envio ao seu contador."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="space-y-1.5">
          <Label className="text-xs">Data início</Label>
          <Input
            type="date"
            className="h-9"
            value={dataInicioInput}
            onChange={(e) => setDataInicioInput(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data fim</Label>
          <Input
            type="date"
            className="h-9"
            value={dataFimInput}
            onChange={(e) => setDataFimInput(e.target.value)}
          />
        </div>
        <Button className="bg-blue-600 hover:bg-blue-600/90" onClick={filtrar}>
          Filtrar
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
            onClick={exportarZip}
          >
            <FileArchive className="h-4 w-4" /> XMLs (ZIP)
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
            onClick={exportarPdf}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CartaoFiscal
          icon={Calculator}
          cor="bg-indigo-500/10 text-indigo-600"
          titulo="Total Faturado"
          valor={fmt(totalFaturado)}
          loading={isLoading}
        />
        <CartaoFiscal
          icon={Package}
          cor="bg-blue-500/10 text-blue-600"
          titulo="NF-e Produtos"
          valor={fmt(totalNfe)}
          loading={isLoading}
        />
        <CartaoFiscal
          icon={ShoppingCart}
          cor="bg-emerald-500/10 text-emerald-600"
          titulo="NFC-e Consumidor"
          valor={fmt(totalNfce)}
          loading={isLoading}
        />
        <CartaoFiscal
          icon={Receipt}
          cor="bg-purple-500/10 text-purple-600"
          titulo="NFS-e Serviços"
          valor={fmt(totalServicos)}
          loading={isLoading}
        />
        <CartaoFiscal
          icon={Calculator}
          cor="bg-muted text-muted-foreground"
          titulo="Diferencial ICMS"
          valor="Não disponível"
          subtitulo="Requer cadastro de UF/regime tributário"
          loading={isLoading}
        />
      </div>
    </div>
  );
}

function CartaoFiscal({
  icon: Icon,
  cor,
  titulo,
  valor,
  subtitulo,
  loading,
}: {
  icon: React.ElementType;
  cor: string;
  titulo: string;
  valor: string;
  subtitulo?: string;
  loading?: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${cor}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      {loading ? (
        <div className="mt-3 h-6 w-24 animate-pulse rounded bg-secondary" />
      ) : (
        <p className="mt-3 text-lg font-extrabold">{valor}</p>
      )}
      <p className="text-xs text-muted-foreground">{titulo}</p>
      {subtitulo && <p className="mt-0.5 text-[11px] text-muted-foreground/70">{subtitulo}</p>}
    </div>
  );
}
