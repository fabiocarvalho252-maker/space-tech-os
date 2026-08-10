import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Percent, Plus, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { brl } from "@/lib/format";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — SpaceTech" },
      { name: "description", content: "Gerenciamento de serviços técnicos e mão de obra." },
    ],
  }),
  component: Servicos,
});

type Servico = {
  id: string;
  nome: string;
  preco_custo: number;
  preco_venda: number;
  comissao_percentual: number | null;
};

function Servicos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [confirmExcluir, setConfirmExcluir] = useState<Servico | null>(null);

  const {
    data: servicos = [],
    isLoading: carregando,
    isError: erro,
    refetch,
  } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("categoria", "Serviço")
        .order("nome");
      if (error) throw error;
      return data as Servico[];
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido");
      setConfirmExcluir(null);
      qc.invalidateQueries({ queryKey: ["servicos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtrados = useMemo(
    () => servicos.filter((s) => s.nome.toLowerCase().includes(busca.toLowerCase())),
    [servicos, busca],
  );

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Mão de obra e reparos técnicos"
        action={
          <Button asChild>
            <Link to="/servicos/adicionar">
              <Plus className="h-4 w-4" /> Novo serviço
            </Link>
          </Button>
        }
      />

      <SearchInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar serviço..."
        className="mb-4 max-w-md"
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3 text-right">Custo adicional</th>
              <th className="px-4 py-3 text-right">Preço de venda</th>
              <th className="px-4 py-3 text-right">Comissão</th>
              <th className="px-4 py-3 text-right">Lucro estimado</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {carregando ? (
              <tr>
                <td colSpan={6} className="p-4">
                  <TableSkeleton />
                </td>
              </tr>
            ) : erro ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="mb-2 text-sm text-destructive">
                    Não foi possível carregar os serviços.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    Tentar novamente
                  </Button>
                </td>
              </tr>
            ) : !filtrados.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-4">
                  <EmptyState
                    icon={Wrench}
                    title="Nenhum serviço encontrado"
                    description={
                      busca
                        ? "Ajuste a busca ou cadastre um novo serviço."
                        : "Cadastre seu primeiro serviço."
                    }
                  />
                </td>
              </tr>
            ) : (
              filtrados.map((s) => {
                const comissao = s.comissao_percentual ?? 0;
                const comissaoValor = (s.preco_venda * comissao) / 100;
                const lucro = s.preco_venda - s.preco_custo - comissaoValor;
                return (
                  <tr key={s.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{s.nome}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {brl(s.preco_custo)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-primary">
                      {brl(s.preco_venda)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {comissao > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Percent className="h-3 w-3" /> {comissao}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${lucro < 0 ? "text-destructive" : ""}`}
                    >
                      {brl(lucro)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <Link to="/servicos/adicionar" search={{ id: s.id }} aria-label="Editar">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <button
                          onClick={() => setConfirmExcluir(s)}
                          aria-label="Excluir"
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(v) => !v && setConfirmExcluir(null)}
        title="Deseja realmente excluir este serviço?"
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
