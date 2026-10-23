import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2, Search, Sparkles, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { buscarModelosCompativeis, type SugestaoPelicula } from "@/lib/peliculas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PeliculaIAResultado } from "@/components/PeliculaIAResultado";

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

function Ferramentas() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "produtos");

  const searchParams = Route.useSearch();
  const [busca, setBusca] = useState(searchParams.busca ?? "");

  useEffect(() => {
    if (searchParams.busca) setBusca(searchParams.busca);
  }, [searchParams.busca]);
  const [resultadoIA, setResultadoIA] = useState<SugestaoPelicula | null>(null);

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
      return buscarModelosCompativeis({ data: { modelo: busca.trim() } });
    },
    onSuccess: (res) => setResultadoIA(res),
    onError: (e: Error) => toast.error(e.message || "Erro ao consultar a IA"),
  });

  // The película column usually lists the sibling models too ("iPhone
  // 13/13 Pro/14"), so searching it finds a phone even without its own row.
  const termo = busca.trim().toLowerCase();
  const filtrados = catalogo.filter((p) =>
    `${p.marca} ${p.modelo} ${p.codigo ?? ""} ${p.pelicula_compativel} ${p.observacoes ?? ""}`
      .toLowerCase()
      .includes(termo),
  );

  return (
    <div>
      <PageHeader
        title="Ferramentas Inteligentes"
        subtitle="Buscador de películas compatíveis, direto para uso na bancada"
      />

      <form
        className="mb-4 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (termo.length >= 2 && !consultarIA.isPending) consultarIA.mutate();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setResultadoIA(null);
            }}
            placeholder="Digite o celular (ex.: Galaxy A54, iPhone 13)..."
            className="pl-9"
          />
        </div>
        <Button type="submit" disabled={termo.length < 2 || consultarIA.isPending}>
          <Sparkles className="h-4 w-4" />
          {consultarIA.isPending ? "Consultando..." : "Consultar IA"}
        </Button>
      </form>

      {resultadoIA && (
        <div className="mb-4">
          <PeliculaIAResultado key={JSON.stringify(resultadoIA)} resultado={resultadoIA} />
        </div>
      )}

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
    </div>
  );
}
