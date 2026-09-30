// Detalhamento do custo de conserto (aprimoramento pedido pelo usuário,
// seções 1/2/8/9/12 do pedido) — cards grandes e touch-friendly (nunca uma
// tabela apertada, seção 13 do pedido), usados tanto no detalhe quanto na
// edição do aparelho. O total mostrado aqui vem sempre da soma ao vivo dos
// itens (não de seminovo.valor_conserto, que pode estar um passo atrás do
// prop recebido pelo componente pai) — a trigger no banco mantém os dois em
// sincronia de qualquer forma.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { categoriaConsertoInfo } from "@/lib/seminovos-conserto";
import { AdicionarCustoConsertoModal } from "./AdicionarCustoConsertoModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type ItemRow = Database["public"]["Tables"]["seminovos_conserto_itens"]["Row"];

export function ConsertoCustosSection({
  seminovoId,
  empresaId,
  podeGerenciar,
  onTotalChange,
}: {
  seminovoId: string;
  empresaId: string;
  podeGerenciar: boolean;
  onTotalChange?: (total: number) => void;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [modalItem, setModalItem] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState<ItemRow | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemRow | null>(null);

  const { data: itens = [] } = useQuery({
    queryKey: ["seminovo-conserto-itens", seminovoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminovos_conserto_itens")
        .select("*")
        .eq("seminovo_id", seminovoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemRow[];
    },
  });

  const total = itens.reduce((s, i) => s + Number(i.valor), 0);

  useEffect(() => {
    onTotalChange?.(total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const porCategoria = Object.values(
    itens.reduce<Record<string, { info: ReturnType<typeof categoriaConsertoInfo>; total: number }>>(
      (acc, i) => {
        const grupo = acc[i.categoria] ?? { info: categoriaConsertoInfo(i.categoria), total: 0 };
        grupo.total += Number(i.valor);
        acc[i.categoria] = grupo;
        return acc;
      },
      {},
    ),
  );

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seminovos_conserto_itens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Custo removido");
      qc.invalidateQueries({ queryKey: ["seminovo-conserto-itens", seminovoId] });
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      // Seminovos disponíveis espelham em Aparelhos (trigger no banco).
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      qc.invalidateQueries({ queryKey: ["seminovo-atual", seminovoId] });
      qc.invalidateQueries({ queryKey: ["seminovo-historico", seminovoId] });
      setItemParaExcluir(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-primary">
            Detalhamento do conserto
          </h3>
        </div>
        {podeGerenciar && (
          <Button
            size="sm"
            variant="outline"
            className="h-10 gap-1.5"
            onClick={() => {
              setItemEmEdicao(null);
              setModalItem(true);
            }}
          >
            <Plus className="h-4 w-4" /> Adicionar custo
          </Button>
        )}
      </div>

      <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary">
        Total do conserto: {brl(total)}
      </div>

      {porCategoria.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {porCategoria.map(({ info, total: totalCategoria }) => (
            <span
              key={info.value}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-3 py-1.5 text-xs font-medium"
            >
              <info.icon className="h-3.5 w-3.5" />
              {info.label} — {brl(totalCategoria)}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {itens.map((i) => {
          const info = categoriaConsertoInfo(i.categoria);
          return (
            <div key={i.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <info.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold">{info.label}</p>
                    {i.descricao && <p className="text-sm text-muted-foreground">{i.descricao}</p>}
                    {i.fornecedor && (
                      <p className="text-xs text-muted-foreground">Fornecedor: {i.fornecedor}</p>
                    )}
                    {i.observacao && (
                      <p className="mt-1 text-xs text-muted-foreground">{i.observacao}</p>
                    )}
                  </div>
                </div>
                <p className="whitespace-nowrap text-lg font-bold">{brl(i.valor)}</p>
              </div>
              {podeGerenciar && (
                <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      setItemEmEdicao(i);
                      setModalItem(true);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-destructive hover:text-destructive"
                    onClick={() => setItemParaExcluir(i)}
                  >
                    Excluir
                  </Button>
                </div>
              )}
            </div>
          );
        })}
        {!itens.length && (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            Nenhum custo de conserto adicionado ainda.
          </p>
        )}
      </div>

      <AdicionarCustoConsertoModal
        open={modalItem}
        onOpenChange={setModalItem}
        seminovoId={seminovoId}
        empresaId={empresaId}
        item={itemEmEdicao}
      />

      <ConfirmDialog
        open={!!itemParaExcluir}
        onOpenChange={(v) => !v && setItemParaExcluir(null)}
        title="Excluir este custo?"
        description={
          itemParaExcluir
            ? `${categoriaConsertoInfo(itemParaExcluir.categoria).label} — ${brl(itemParaExcluir.valor)}`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => itemParaExcluir && remover.mutate(itemParaExcluir.id)}
      />
    </div>
  );
}
