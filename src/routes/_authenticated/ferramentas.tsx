import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2, Search, Sparkles, Layers, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { buscarModelosCompativeis } from "@/lib/peliculas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/ferramentas")({
  head: () => ({
    meta: [
      { title: "Ferramentas Inteligentes — SpaceTech" },
      { name: "description", content: "Buscador de películas compatíveis para a bancada." },
    ],
  }),
  // ?busca=<termo> lets the Home película-search card hand its typed term
  // over to this page's real search instead of duplicating the filter logic.
  validateSearch: (search: Record<string, unknown>): { busca?: string } => {
    const busca = search["busca"];
    return typeof busca === "string" ? { busca } : {};
  },
  component: Ferramentas,
});

const vazio = { marca: "", modelo: "", codigo: "", pelicula_compativel: "", observacoes: "" };

function Ferramentas() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "produtos");

  const searchParams = Route.useSearch();
  const [busca, setBusca] = useState(searchParams.busca ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.busca) setBusca(searchParams.busca);
  }, [searchParams.busca]);
  const [form, setForm] = useState(vazio);
  const [resultadoIA, setResultadoIA] = useState<{
    modelos: string | undefined;
    detalhes?: string | undefined;
  } | null>(null);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["peliculas-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peliculas_catalogo")
        .select("*")
        .order("marca")
        .order("modelo");
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.marca.trim() || !form.modelo.trim() || !form.pelicula_compativel.trim()) {
        throw new Error("Informe marca, modelo e a película compatível");
      }
      const { error } = await supabase
        .from("peliculas_catalogo")
        .insert({ ...form, user_id: empresaId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item cadastrado no catálogo");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["peliculas-catalogo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("peliculas_catalogo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      qc.invalidateQueries({ queryKey: ["peliculas-catalogo"] });
    },
  });

  const consultarIA = useMutation({
    mutationFn: async () => {
      const res = await buscarModelosCompativeis({ data: { modelo: busca } });
      return res;
    },
    onSuccess: (res) => setResultadoIA(res ?? { modelos: "Nenhum modelo compatível encontrado." }),
    onError: () => toast.error("Erro ao consultar a IA"),
  });

  const filtrados = catalogo.filter((p) =>
    `${p.marca} ${p.modelo} ${p.codigo ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Ferramentas Inteligentes"
        subtitle="Buscador de películas compatíveis, direto para uso na bancada"
        action={
          gerenciar && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Novo item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo item no catálogo</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo
                    label="Marca"
                    value={form.marca}
                    onChange={(v) => setForm({ ...form, marca: v })}
                  />
                  <Campo
                    label="Modelo"
                    value={form.modelo}
                    onChange={(v) => setForm({ ...form, modelo: v })}
                  />
                  <Campo
                    label="Código"
                    value={form.codigo}
                    onChange={(v) => setForm({ ...form, codigo: v })}
                  />
                  <Campo
                    label="Película compatível"
                    value={form.pelicula_compativel}
                    onChange={(v) => setForm({ ...form, pelicula_compativel: v })}
                  />
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                  Salvar
                </Button>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setResultadoIA(null);
          }}
          placeholder="Buscar por marca, modelo ou código..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Modelo</th>
                <th className="hidden px-4 py-3 sm:table-cell">Marca</th>
                <th className="px-4 py-3">Película compatível</th>
                <th className="hidden px-4 py-3 md:table-cell">Código</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.modelo}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {p.marca}
                  </td>
                  <td className="px-4 py-3">{p.pelicula_compativel}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {p.codigo || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {gerenciar && (
                      <button
                        onClick={() => remover.mutate(p.id)}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!filtrados.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Layers className="h-6 w-6 opacity-40" />
                      {busca
                        ? "Nada encontrado no catálogo para essa busca."
                        : "Nenhum item cadastrado no catálogo ainda."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {busca && !filtrados.length && (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-primary" /> Sem cadastro? Pergunte à IA
            </h2>
            <Button size="sm" onClick={() => consultarIA.mutate()} disabled={consultarIA.isPending}>
              {consultarIA.isPending ? "Consultando..." : "Consultar IA"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A IA pode sugerir modelos com a mesma película com base no mercado, mas não substitui a
            conferência manual na bancada.
          </p>
          {resultadoIA && (
            <div className="mt-3 space-y-2 border-t border-primary/10 pt-3">
              <p className="flex items-center gap-1 text-xs font-bold uppercase text-primary">
                <Target className="h-3 w-3" /> Modelos compatíveis
              </p>
              <p className="text-sm font-semibold leading-relaxed">{resultadoIA.modelos}</p>
              {resultadoIA.detalhes && (
                <p className="text-xs italic leading-relaxed text-muted-foreground">
                  {resultadoIA.detalhes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
