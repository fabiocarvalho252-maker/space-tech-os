import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { renderToString } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  History,
  PackagePlus,
  Package,
  Pencil,
  Plus,
  Power,
  Printer,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { brl } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HistoricoEstoqueDialog } from "@/components/HistoricoEstoqueDialog";
import { AjustarEstoqueDialog } from "@/components/AjustarEstoqueDialog";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Produtos — SpaceTech" },
      {
        name: "description",
        content: "Controle de peças, acessórios e níveis mínimos de produtos.",
      },
      { property: "og:title", content: "Produtos — SpaceTech" },
      { property: "og:description", content: "Peças e acessórios sempre sob controle." },
    ],
  }),
  component: Estoque,
});

type Produto = {
  id: string;
  nome: string;
  sku: string | null;
  codigo_barras: string | null;
  categoria: string | null;
  preco_custo: number;
  preco_venda: number;
  quantidade: number;
  estoque_minimo: number;
  marca: string | null;
  localizacao: string | null;
  ativo: boolean;
};

const vazio = {
  nome: "",
  sku: "",
  codigo_barras: "",
  categoria: "",
  preco_custo: "0",
  preco_venda: "0",
  quantidade: "0",
  estoque_minimo: "1",
  marca: "",
  localizacao: "",
  ativo: true,
};

type FiltroSituacao = "ativos" | "inativos" | "baixo" | "todos";

const POR_PAGINA = 15;
type Ordenacao = { campo: "nome" | "preco_venda" | "quantidade"; direcao: "asc" | "desc" };

function situacaoEstoque(p: Produto) {
  if (p.quantidade <= 0)
    return { label: "Sem estoque", tone: "danger" as const, icon: AlertCircle };
  if (p.quantidade <= p.estoque_minimo)
    return { label: "Estoque baixo", tone: "warning" as const, icon: AlertCircle };
  return { label: "Normal", tone: "success" as const, icon: undefined };
}

const escHtml = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Código de barras em SVG: EAN-13/EAN-8 quando o código é um EAN válido,
// senão Code 128 (aceita o SKU). O leitor do PDV acha o produto pelo código
// de barras e, se não houver, pelo SKU.
function barcodeSvg(codigo: string): string | null {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const formatos = /^\d{13}$/.test(codigo) ? ["EAN13"] : /^\d{8}$/.test(codigo) ? ["EAN8"] : [];
  for (const format of [...formatos, "CODE128"]) {
    try {
      JsBarcode(svg, codigo, { format, height: 40, width: 1.6, fontSize: 12, margin: 0 });
      return svg.outerHTML;
    } catch {
      // EAN com dígito verificador errado: tenta o próximo formato.
    }
  }
  return null;
}

function imprimirEtiquetas(produtos: Produto[]) {
  if (!produtos.length) {
    toast.error("Nenhum produto para gerar etiqueta.");
    return;
  }
  const janela = window.open("", "_blank", "width=800,height=900");
  if (!janela) return;
  const etiquetas = produtos
    .map((p) => {
      const codigo = (p.codigo_barras || p.sku || "").trim();
      const barras = codigo ? barcodeSvg(codigo) : null;
      const desenho = barras ?? renderToString(<QRCodeSVG value={p.id} size={72} />);
      return `<div class="etq${barras ? " barras" : ""}">
        <div class="codigo">${desenho}</div>
        <div class="info">
          <strong>${escHtml(p.nome)}</strong>
          ${p.sku && p.sku !== codigo ? `<span>SKU: ${escHtml(p.sku)}</span>` : ""}
          <span class="preco">${brl(p.preco_venda)}</span>
        </div>
      </div>`;
    })
    .join("");
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Etiquetas de produtos</title>
    <style>
      body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#fff}
      .grade{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .etq{display:flex;align-items:center;gap:8px;border:1px dashed #999;border-radius:8px;padding:8px;break-inside:avoid}
      .etq.barras{flex-direction:column-reverse;align-items:stretch;text-align:center}
      .codigo svg{max-width:100%;height:auto}
      .info{display:flex;flex-direction:column;font-size:11px;line-height:1.3}
      .preco{font-weight:800;font-size:13px}
      @media print{.etq{border:1px solid #ccc}}
    </style></head><body>
    <div class="grade">${etiquetas}</div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  janela.document.close();
}

function Estoque() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"fechado" | "criar" | "editar" | "ver">("fechado");
  const [form, setForm] = useState(vazio);
  const [produtoAtual, setProdutoAtual] = useState<Produto | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<Produto | null>(null);
  const [historico, setHistorico] = useState<Produto | null>(null);
  const [ajuste, setAjuste] = useState<Produto | null>(null);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: "nome", direcao: "asc" });
  const [pagina, setPagina] = useState(1);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroMarca, setFiltroMarca] = useState("todas");
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>("ativos");

  const {
    data: produtos = [],
    isLoading: carregando,
    isError: erro,
    refetch,
  } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .or("categoria.neq.Serviço,categoria.is.null")
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  const { data: estoqueConfig } = useQuery({
    queryKey: ["estoque-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_config").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: categoriasProduto = [] } = useQuery({
    queryKey: ["produto-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produto_categorias").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; nome: string }[];
    },
  });

  function abrirCriar() {
    setForm({ ...vazio, estoque_minimo: String(estoqueConfig?.estoque_minimo_padrao ?? 1) });
    setProdutoAtual(null);
    setModo("criar");
  }
  function abrirEditar(p: Produto) {
    setForm({
      nome: p.nome,
      sku: p.sku ?? "",
      codigo_barras: p.codigo_barras ?? "",
      categoria: p.categoria ?? "",
      preco_custo: String(p.preco_custo),
      preco_venda: String(p.preco_venda),
      quantidade: String(p.quantidade),
      estoque_minimo: String(p.estoque_minimo),
      marca: p.marca ?? "",
      localizacao: p.localizacao ?? "",
      ativo: p.ativo,
    });
    setProdutoAtual(p);
    setModo("editar");
  }
  function abrirVer(p: Produto) {
    setProdutoAtual(p);
    setModo("ver");
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do produto");
      if (!form.categoria.trim()) throw new Error("Informe a categoria do produto");
      if (Number(form.preco_venda) <= 0)
        throw new Error("O preço de venda deve ser maior que zero");

      if (form.sku) {
        const { data: existente } = await supabase
          .from("produtos")
          .select("id")
          .eq("user_id", empresaId!)
          .eq("sku", form.sku)
          .neq("id", produtoAtual?.id ?? "")
          .maybeSingle();
        if (existente) throw new Error("Este SKU já está em uso");
      }

      const codigoBarras = form.codigo_barras.trim();
      if (codigoBarras) {
        const { data: existente } = await supabase
          .from("produtos")
          .select("nome")
          .eq("user_id", empresaId!)
          .eq("codigo_barras", codigoBarras)
          .neq("id", produtoAtual?.id ?? "")
          .limit(1)
          .maybeSingle();
        if (existente) throw new Error(`Este código de barras já está em "${existente.nome}"`);
      }

      const payload = {
        nome: form.nome,
        sku: form.sku || null,
        codigo_barras: codigoBarras || null,
        categoria: form.categoria || null,
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        quantidade: Number(form.quantidade) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
        marca: form.marca.trim() || null,
        localizacao: form.localizacao.trim() || null,
        ativo: form.ativo,
      };

      if (produtoAtual) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", produtoAtual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("produtos")
          .insert({ ...payload, user_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(produtoAtual ? "Produto atualizado" : "Produto cadastrado");
      setModo("fechado");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["dashboard-home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: async (p: Produto) => {
      const { error } = await supabase.from("produtos").insert({
        user_id: empresaId!,
        nome: `${p.nome} (cópia)`,
        sku: null,
        categoria: p.categoria,
        preco_custo: p.preco_custo,
        preco_venda: p.preco_venda,
        quantidade: 0,
        estoque_minimo: p.estoque_minimo,
        marca: p.marca,
        localizacao: p.localizacao,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto duplicado");
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarAtivo = useMutation({
    mutationFn: async (p: Produto) => {
      const { error } = await supabase.from("produtos").update({ ativo: !p.ativo }).eq("id", p.id);
      if (error) throw error;
      return !p.ativo;
    },
    onSuccess: (ativo) => {
      toast.success(ativo ? "Produto reativado" : "Produto desativado");
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido");
      setConfirmExcluir(null);
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const baixoEstoque = produtos.filter((p) => p.ativo && p.quantidade <= p.estoque_minimo);

  const categorias = useMemo(
    () =>
      Array.from(new Set(produtos.map((p) => p.categoria).filter((c): c is string => !!c))).sort(),
    [produtos],
  );
  const marcas = useMemo(
    () =>
      Array.from(
        new Set(produtos.map((p) => p.marca?.trim()).filter((m): m is string => !!m)),
      ).sort((a, b) => a.localeCompare(b)),
    [produtos],
  );

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase();
    const lista = produtos.filter((p) => {
      if (filtroSituacao === "ativos" && !p.ativo) return false;
      if (filtroSituacao === "inativos" && p.ativo) return false;
      if (filtroSituacao === "baixo" && !(p.ativo && p.quantidade <= p.estoque_minimo))
        return false;
      if (filtroCategoria !== "todas" && p.categoria !== filtroCategoria) return false;
      if (filtroMarca !== "todas" && p.marca?.trim() !== filtroMarca) return false;
      return (
        p.nome.toLowerCase().includes(termo) ||
        (!!p.sku && p.sku.toLowerCase().includes(termo)) ||
        (!!p.marca && p.marca.toLowerCase().includes(termo)) ||
        (!!p.localizacao && p.localizacao.toLowerCase().includes(termo)) ||
        (!!p.codigo_barras && p.codigo_barras.includes(busca.trim()))
      );
    });
    const dir = ordenacao.direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      const av = a[ordenacao.campo];
      const bv = b[ordenacao.campo];
      if (typeof av === "string") return av.localeCompare(bv as string) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [produtos, busca, ordenacao, filtroSituacao, filtroCategoria, filtroMarca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  function alternarOrdenacao(campo: Ordenacao["campo"]) {
    setPagina(1);
    setOrdenacao((o) =>
      o.campo === campo
        ? { campo, direcao: o.direcao === "asc" ? "desc" : "asc" }
        : { campo, direcao: "asc" },
    );
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Peças, acessórios e alertas de reposição"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
              onClick={() => imprimirEtiquetas(filtrados)}
            >
              <Tag className="h-4 w-4" /> Gerar Etiquetas
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-600/90" onClick={abrirCriar}>
              <Plus className="h-4 w-4" /> Produtos
            </Button>
          </div>
        }
      />

      {baixoEstoque.length > 0 && (
        <div className="mb-6 flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-bold">Atenção: Estoque Baixo</h3>
            <p className="text-sm opacity-90">
              Você tem {baixoEstoque.length} {baixoEstoque.length === 1 ? "produto" : "produtos"}{" "}
              atingindo o nível mínimo.{" "}
              {baixoEstoque
                .slice(0, 3)
                .map((p) => p.nome)
                .join(", ")}
              {baixoEstoque.length > 3 ? " e outros..." : ""}
            </p>
          </div>
        </div>
      )}

      <SearchInput
        value={busca}
        onChange={(v) => {
          setBusca(v);
          setPagina(1);
        }}
        placeholder="Buscar por nome, SKU, marca ou localização..."
        className="mb-3 max-w-md"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FiltroSelect
          value={filtroSituacao}
          onChange={(v) => {
            setFiltroSituacao(v as FiltroSituacao);
            setPagina(1);
          }}
          opcoes={[
            ["ativos", "Ativos"],
            ["baixo", "Estoque baixo"],
            ["inativos", "Inativos"],
            ["todos", "Todos"],
          ]}
        />
        <FiltroSelect
          value={filtroCategoria}
          onChange={(v) => {
            setFiltroCategoria(v);
            setPagina(1);
          }}
          opcoes={[["todas", "Todas as categorias"], ...categorias.map((c) => [c, c] as const)]}
        />
        <FiltroSelect
          value={filtroMarca}
          onChange={(v) => {
            setFiltroMarca(v);
            setPagina(1);
          }}
          opcoes={[["todas", "Todas as marcas"], ...marcas.map((m) => [m, m] as const)]}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <ThOrdenavel
                label="Produto"
                campo="nome"
                ordenacao={ordenacao}
                onClick={alternarOrdenacao}
              />
              <th className="px-4 py-3">Categoria</th>
              <ThOrdenavel
                label="Preço"
                campo="preco_venda"
                ordenacao={ordenacao}
                onClick={alternarOrdenacao}
                align="right"
              />
              <ThOrdenavel
                label="Estoque"
                campo="quantidade"
                ordenacao={ordenacao}
                onClick={alternarOrdenacao}
                align="center"
              />
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {carregando ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <TableSkeleton />
                </td>
              </tr>
            ) : erro ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="mb-2 text-sm text-destructive">
                    Não foi possível carregar os produtos.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </td>
              </tr>
            ) : !visiveis.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-4">
                  <EmptyState
                    icon={Package}
                    title="Nenhum produto encontrado"
                    description={
                      busca
                        ? "Ajuste a busca ou cadastre um novo produto."
                        : "Cadastre seu primeiro produto."
                    }
                  />
                </td>
              </tr>
            ) : (
              visiveis.map((p) => {
                const situacao = situacaoEstoque(p);
                return (
                  <tr key={p.id} className={`hover:bg-secondary/30 ${p.ativo ? "" : "opacity-60"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {p.nome}
                            {!p.ativo && (
                              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                Inativo
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {[p.marca, p.sku || "Sem SKU", p.localizacao && `📍 ${p.localizacao}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.categoria || "Sem categoria"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold">{brl(p.preco_venda)}</p>
                      <p className="text-xs text-muted-foreground">custo {brl(p.preco_custo)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold">{p.quantidade}</span>
                        <StatusBadge
                          label={situacao.label}
                          tone={situacao.tone}
                          {...(situacao.icon ? { icon: situacao.icon } : {})}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <IconAction label="Visualizar" onClick={() => abrirVer(p)}>
                          <Eye className="h-4 w-4" />
                        </IconAction>
                        <IconAction label="Ajustar estoque" onClick={() => setAjuste(p)}>
                          <PackagePlus className="h-4 w-4" />
                        </IconAction>
                        <IconAction label="Histórico de estoque" onClick={() => setHistorico(p)}>
                          <History className="h-4 w-4" />
                        </IconAction>
                        <IconAction label="Duplicar" onClick={() => duplicar.mutate(p)}>
                          <Copy className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label="Imprimir etiqueta"
                          onClick={() => imprimirEtiquetas([p])}
                        >
                          <Printer className="h-4 w-4" />
                        </IconAction>
                        <IconAction label="Editar" onClick={() => abrirEditar(p)}>
                          <Pencil className="h-4 w-4" />
                        </IconAction>
                        <IconAction
                          label={p.ativo ? "Desativar" : "Reativar"}
                          onClick={() => alternarAtivo.mutate(p)}
                        >
                          <Power className={`h-4 w-4 ${p.ativo ? "" : "text-emerald-600"}`} />
                        </IconAction>
                        <IconAction
                          label="Excluir"
                          destructive
                          onClick={() => setConfirmExcluir(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconAction>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {paginaAtual} de {totalPaginas} · {filtrados.length} produtos
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={modo === "criar" || modo === "editar"}
        onOpenChange={(v) => !v && setModo("fechado")}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{produtoAtual ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
            <Campo label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
            <Campo
              label="Código de barras"
              value={form.codigo_barras}
              onChange={(v) => setForm({ ...form, codigo_barras: v })}
              placeholder="Leia com o leitor ou digite"
            />
            <Campo
              label="Categoria"
              value={form.categoria}
              onChange={(v) => setForm({ ...form, categoria: v })}
              list="categorias-produto"
            />
            <Campo
              label="Marca"
              value={form.marca}
              onChange={(v) => setForm({ ...form, marca: v })}
              list="marcas-produto"
              placeholder="Ex.: Samsung, Apple, Genérica"
            />
            <Campo
              label="Localização"
              value={form.localizacao}
              onChange={(v) => setForm({ ...form, localizacao: v })}
              placeholder="Ex.: Gaveta 3, Prateleira B"
            />
            <Campo
              label="Quantidade"
              type="number"
              value={form.quantidade}
              onChange={(v) => setForm({ ...form, quantidade: v })}
            />
            <Campo
              label="Preço de custo"
              type="number"
              value={form.preco_custo}
              onChange={(v) => setForm({ ...form, preco_custo: v })}
            />
            <Campo
              label="Preço de venda"
              type="number"
              value={form.preco_venda}
              onChange={(v) => setForm({ ...form, preco_venda: v })}
            />
            <Campo
              label="Estoque mínimo"
              type="number"
              value={form.estoque_minimo}
              onChange={(v) => setForm({ ...form, estoque_minimo: v })}
            />
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 sm:col-span-2">
              <span>
                <span className="block text-sm font-medium">Produto ativo</span>
                <span className="block text-xs text-muted-foreground">
                  Inativo não aparece no PDV, nas vendas, na OS nem nas compras.
                </span>
              </span>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
            </label>
          </div>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar produto"}
          </Button>
        </DialogContent>
      </Dialog>

      <datalist id="categorias-produto">
        {categoriasProduto.map((c) => (
          <option key={c.id} value={c.nome} />
        ))}
      </datalist>
      <datalist id="marcas-produto">
        {marcas.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <Dialog open={modo === "ver"} onOpenChange={(v) => !v && setModo("fechado")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{produtoAtual?.nome}</DialogTitle>
          </DialogHeader>
          {produtoAtual && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="SKU" value={produtoAtual.sku || "—"} />
              <Info label="Código de barras" value={produtoAtual.codigo_barras || "—"} />
              <Info label="Categoria" value={produtoAtual.categoria || "Sem categoria"} />
              <Info label="Marca" value={produtoAtual.marca || "—"} />
              <Info label="Localização" value={produtoAtual.localizacao || "—"} />
              <Info label="Situação" value={produtoAtual.ativo ? "Ativo" : "Inativo"} />
              <Info label="Preço de custo" value={brl(produtoAtual.preco_custo)} />
              <Info label="Preço de venda" value={brl(produtoAtual.preco_venda)} />
              <Info label="Quantidade em estoque" value={String(produtoAtual.quantidade)} />
              <Info label="Estoque mínimo" value={String(produtoAtual.estoque_minimo)} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <HistoricoEstoqueDialog produto={historico} onOpenChange={(v) => !v && setHistorico(null)} />
      <AjustarEstoqueDialog produto={ajuste} onOpenChange={(v) => !v && setAjuste(null)} />

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(v) => !v && setConfirmExcluir(null)}
        title="Deseja realmente excluir este produto?"
        description={
          confirmExcluir
            ? `"${confirmExcluir.nome}" será removido permanentemente. Para tirar das vendas sem perder o histórico, prefira Desativar.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => confirmExcluir && remover.mutate(confirmExcluir.id)}
      />
    </div>
  );
}

function ThOrdenavel({
  label,
  campo,
  ordenacao,
  onClick,
  align = "left",
}: {
  label: string;
  campo: Ordenacao["campo"];
  ordenacao: Ordenacao;
  onClick: (campo: Ordenacao["campo"]) => void;
  align?: "left" | "right" | "center";
}) {
  const ativo = ordenacao.campo === campo;
  const Icone = ativo ? (ordenacao.direcao === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`px-4 py-3 text-${align}`}>
      <button
        onClick={() => onClick(campo)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label} <Icone className="h-3 w-3" />
      </button>
    </th>
  );
}

function IconAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary ${
        destructive ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FiltroSelect({
  value,
  onChange,
  opcoes,
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: (readonly [string, string])[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map(([v, rotulo]) => (
          <SelectItem key={v} value={v}>
            {rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
  list,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  list?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        step="0.01"
        list={list}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
