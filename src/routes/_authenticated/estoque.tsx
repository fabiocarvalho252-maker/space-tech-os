import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { renderToString } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  Package,
  Pencil,
  Plus,
  Printer,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/SearchInput";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  categoria: string | null;
  preco_custo: number;
  preco_venda: number;
  quantidade: number;
  estoque_minimo: number;
};

const vazio = {
  nome: "",
  sku: "",
  categoria: "",
  preco_custo: "0",
  preco_venda: "0",
  quantidade: "0",
  estoque_minimo: "1",
};

const POR_PAGINA = 15;
type Ordenacao = { campo: "nome" | "preco_venda" | "quantidade"; direcao: "asc" | "desc" };

function situacaoEstoque(p: Produto) {
  if (p.quantidade <= 0)
    return { label: "Sem estoque", tone: "danger" as const, icon: AlertCircle };
  if (p.quantidade <= p.estoque_minimo)
    return { label: "Estoque baixo", tone: "warning" as const, icon: AlertCircle };
  return { label: "Normal", tone: "success" as const, icon: undefined };
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
      const qr = renderToString(<QRCodeSVG value={p.sku || p.id} size={72} />);
      return `<div class="etq">
        <div class="qr">${qr}</div>
        <div class="info">
          <strong>${p.nome}</strong>
          <span>${p.sku ? "SKU: " + p.sku : ""}</span>
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
      .info{display:flex;flex-direction:column;font-size:11px;line-height:1.3}
      .preco{font-weight:800;font-size:13px}
      @media print{.etq{border:1px solid #ccc}}
    </style></head><body>
    <div class="grade">${etiquetas}</div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`);
  janela.document.close();
}

function Estoque() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"fechado" | "criar" | "editar" | "ver">("fechado");
  const [form, setForm] = useState(vazio);
  const [produtoAtual, setProdutoAtual] = useState<Produto | null>(null);
  const [confirmExcluir, setConfirmExcluir] = useState<Produto | null>(null);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>({ campo: "nome", direcao: "asc" });
  const [pagina, setPagina] = useState(1);

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
        .neq("categoria", "Serviço")
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  function abrirCriar() {
    setForm(vazio);
    setProdutoAtual(null);
    setModo("criar");
  }
  function abrirEditar(p: Produto) {
    setForm({
      nome: p.nome,
      sku: p.sku ?? "",
      categoria: p.categoria ?? "",
      preco_custo: String(p.preco_custo),
      preco_venda: String(p.preco_venda),
      quantidade: String(p.quantidade),
      estoque_minimo: String(p.estoque_minimo),
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
      if (Number(form.preco_venda) <= 0)
        throw new Error("O preço de venda deve ser maior que zero");

      if (form.sku) {
        const { data: existente } = await supabase
          .from("produtos")
          .select("id")
          .eq("user_id", user!.id)
          .eq("sku", form.sku)
          .neq("id", produtoAtual?.id ?? "")
          .maybeSingle();
        if (existente) throw new Error("Este SKU já está em uso");
      }

      const payload = {
        nome: form.nome,
        sku: form.sku || null,
        categoria: form.categoria || null,
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        quantidade: Number(form.quantidade) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
      };

      if (produtoAtual) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", produtoAtual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert({ ...payload, user_id: user!.id });
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
        user_id: user!.id,
        nome: `${p.nome} (cópia)`,
        sku: null,
        categoria: p.categoria,
        preco_custo: p.preco_custo,
        preco_venda: p.preco_venda,
        quantidade: 0,
        estoque_minimo: p.estoque_minimo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto duplicado");
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

  const baixoEstoque = produtos.filter((p) => p.quantidade <= p.estoque_minimo);

  const filtrados = useMemo(() => {
    const lista = produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(busca.toLowerCase())),
    );
    const dir = ordenacao.direcao === "asc" ? 1 : -1;
    return [...lista].sort((a, b) => {
      const av = a[ordenacao.campo];
      const bv = b[ordenacao.campo];
      if (typeof av === "string") return av.localeCompare(bv as string) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [produtos, busca, ordenacao]);

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
        placeholder="Buscar por nome ou SKU..."
        className="mb-4 max-w-md"
      />

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
                  <tr key={p.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.nome}</p>
                          <p className="text-xs text-muted-foreground">{p.sku || "Sem SKU"}</p>
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
              label="Categoria"
              value={form.categoria}
              onChange={(v) => setForm({ ...form, categoria: v })}
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
          </div>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar produto"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={modo === "ver"} onOpenChange={(v) => !v && setModo("fechado")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{produtoAtual?.nome}</DialogTitle>
          </DialogHeader>
          {produtoAtual && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="SKU" value={produtoAtual.sku || "—"} />
              <Info label="Categoria" value={produtoAtual.categoria || "Sem categoria"} />
              <Info label="Preço de custo" value={brl(produtoAtual.preco_custo)} />
              <Info label="Preço de venda" value={brl(produtoAtual.preco_venda)} />
              <Info label="Quantidade em estoque" value={String(produtoAtual.quantidade)} />
              <Info label="Estoque mínimo" value={String(produtoAtual.estoque_minimo)} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(v) => !v && setConfirmExcluir(null)}
        title="Deseja realmente excluir este produto?"
        description={
          confirmExcluir ? `"${confirmExcluir.nome}" será removido permanentemente.` : ""
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
