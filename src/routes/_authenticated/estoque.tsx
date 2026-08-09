import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Trash2, Minus, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Produtos — SpaceTech" },
      { name: "description", content: "Controle de peças, acessórios e níveis mínimos de produtos." },
      { property: "og:title", content: "Produtos — SpaceTech" },
      { property: "og:description", content: "Peças e acessórios sempre sob controle." },

    ],
  }),
  component: Estoque,
});

const vazio = {
  nome: "",
  sku: "",
  categoria: "",
  preco_custo: "0",
  preco_venda: "0",
  quantidade: "0",
  estoque_minimo: "1",
};

function Estoque() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(vazio);

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").neq("categoria", "Serviço").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do produto");
      if (Number(form.preco_venda) <= 0) throw new Error("O preço de venda deve ser maior que zero");
      
      const { data: existing } = await supabase
        .from("produtos")
        .select("id")
        .eq("user_id", user!.id)
        .eq("sku", form.sku)
        .maybeSingle();

      if (form.sku && existing) throw new Error("Este SKU já está em uso");

      const { error } = await supabase.from("produtos").insert({
        user_id: user!.id,
        nome: form.nome,
        sku: form.sku || null,
        categoria: form.categoria || null,
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        quantidade: Number(form.quantidade) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto cadastrado");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ajustar = useMutation({
    mutationFn: async ({ id, quantidade }: { id: string; quantidade: number }) => {
      const { error } = await supabase
        .from("produtos")
        .update({ quantidade: Math.max(0, quantidade) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido");
      qc.invalidateQueries({ queryKey: ["produtos"] });
    },
  });

  const baixoEstoque = produtos.filter(p => p.quantidade <= p.estoque_minimo);
  const filtrados = useMemo(() => {
    return produtos.filter(p => 
      p.nome.toLowerCase().includes(busca.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(busca.toLowerCase()))
    );
  }, [produtos, busca]);

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Peças, acessórios e alertas de reposição"

        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo produto</DialogTitle>
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
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                Salvar produto
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      {baixoEstoque.length > 0 && (
        <div className="mb-6 flex items-start gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-bold">Atenção: Estoque Baixo</h3>
            <p className="text-sm opacity-90">
              Você tem {baixoEstoque.length} {baixoEstoque.length === 1 ? 'produto' : 'produtos'} atingindo o nível mínimo. 
              {baixoEstoque.slice(0, 3).map(p => p.nome).join(', ')}{baixoEstoque.length > 3 ? ' e outros...' : ''}
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou SKU..." 
          className="pl-9 max-w-md"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3 text-right">Custo</th>
              <th className="px-4 py-3 text-right">Venda</th>
              <th className="px-4 py-3 text-center">Estoque</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.categoria || "Sem categoria"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.sku || "—"}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{brl(p.preco_custo)}</td>
                <td className="px-4 py-3 text-right font-semibold">{brl(p.preco_venda)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => ajustar.mutate({ id: p.id, quantidade: p.quantidade - 1 })}
                      className="rounded-md border border-input p-1 hover:bg-muted"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span
                      className={`w-10 text-center font-bold ${
                        p.quantidade <= p.estoque_minimo ? "text-destructive" : ""
                      }`}
                    >
                      {p.quantidade}
                    </span>
                    <button
                      onClick={() => ajustar.mutate({ id: p.id, quantidade: p.quantidade + 1 })}
                      className="rounded-md border border-input p-1 hover:bg-muted"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remover.mutate(p.id)}
                    className="text-muted-foreground transition hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!filtrados.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
