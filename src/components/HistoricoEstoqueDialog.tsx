// Histórico de movimentação de um produto (estoque_movimentacoes): cada
// mudança de quantidade — venda, uso em OS, compra, cancelamento, ajuste
// manual — com o saldo antes e depois. As linhas são gravadas por um gatilho
// no banco, então valem para qualquer tela que mexa no estoque.
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Movimentacao = {
  id: string;
  tipo: string;
  quantidade: number;
  saldo_anterior: number;
  saldo_posterior: number;
  descricao: string | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste manual",
  venda: "Venda",
  cancelamento_venda: "Venda cancelada",
  exclusao_venda: "Venda excluída",
  uso_os: "Usado em OS",
  devolucao_os: "Devolvido da OS",
  compra: "Compra",
  cancelamento_compra: "Compra cancelada",
};

const LIMITE = 100;

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoricoEstoqueDialog({
  produto,
  onOpenChange,
}: {
  produto: { id: string; nome: string; quantidade: number } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["estoque-movimentacoes", produto?.id],
    enabled: !!produto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_movimentacoes" as any)
        .select("id, tipo, quantidade, saldo_anterior, saldo_posterior, descricao, created_at")
        .eq("produto_id", produto!.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (error) throw error;
      return data as unknown as Movimentacao[];
    },
  });

  return (
    <Dialog open={!!produto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Histórico de estoque
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {produto?.nome} · estoque atual: <strong>{produto?.quantidade}</strong>
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : movimentacoes.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma movimentação registrada ainda. O histórico começa a partir de 24/10/2026.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {movimentacoes.map((m) => {
              const entrou = m.quantidade > 0;
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      entrou ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600",
                    )}
                  >
                    {entrou ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{TIPO_LABEL[m.tipo] ?? m.tipo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dataHora(m.created_at)}
                      {m.descricao ? ` · ${m.descricao}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        entrou ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {entrou ? "+" : ""}
                      {m.quantidade}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.saldo_anterior} → {m.saldo_posterior}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {movimentacoes.length === LIMITE && (
          <p className="text-center text-xs text-muted-foreground">
            Mostrando as {LIMITE} movimentações mais recentes.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
