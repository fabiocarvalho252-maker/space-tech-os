import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { dataHoraBR } from "@/lib/format";
import { Button } from "@/components/ui/button";

type ItemPendente = {
  id: string;
  produto_id: string | null;
  descricao: string;
  quantidade: number;
  custo_unitario: number;
  produto: { id: string; preco_venda: number } | null;
};

type EntradaPendente = {
  id: string;
  recebido_em: string | null;
  numero_nota: string | null;
  serie_nota: string | null;
  created_at: string;
  valor_total: number;
  fornecedor: { razao_social: string; nome_fantasia: string | null } | null;
  itens: ItemPendente[];
};

// Lista as notas importadas que ainda não deram entrada no estoque.
export function EntradasNotaPendentes() {
  const qc = useQueryClient();
  const { formatFinancialValue: brl } = useFinancialVisibility();

  const { data: entradas = [] } = useQuery({
    queryKey: ["entradas-nota-pendentes"],
    queryFn: async (): Promise<EntradaPendente[]> => {
      const { data, error } = await supabase
        .from("compras")
        .select(
          "id, recebido_em, numero_nota, serie_nota, created_at, valor_total, fornecedor:fornecedores(razao_social, nome_fantasia), itens:compra_itens(id, produto_id, descricao, quantidade, custo_unitario, produto:produtos(id, preco_venda))",
        )
        .eq("nota_importada", true)
        .is("entrada_aprovada_em", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as EntradaPendente[];
    },
  });

  if (!entradas.length) return null;

  return (
    <section className="mb-6 space-y-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div>
        <h2 className="text-base font-semibold">Entradas aguardando aprovação</h2>
        <p className="text-sm text-muted-foreground">
          Confira o valor de revenda final de cada produto e aprove. Notas que ainda não entraram no
          estoque são lançadas na aprovação.
        </p>
      </div>
      {entradas.map((e) => (
        <EntradaCard
          key={e.id}
          entrada={e}
          brl={brl}
          onAprovada={() => {
            qc.invalidateQueries({ queryKey: ["entradas-nota-pendentes"] });
            qc.invalidateQueries({ queryKey: ["produtos"] });
            qc.invalidateQueries({ queryKey: ["produtos-compras"] });
            qc.invalidateQueries({ queryKey: ["compras"] });
          }}
        />
      ))}
    </section>
  );
}

function EntradaCard({
  entrada,
  brl,
  onAprovada,
}: {
  entrada: EntradaPendente;
  brl: (valor: number) => string;
  onAprovada: () => void;
}) {
  // Valor de revenda digitado por produto; começa com o preço atual cadastrado.
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      entrada.itens
        .filter((i) => i.produto_id)
        .map((i) => [i.produto_id as string, String(i.produto?.preco_venda ?? 0)]),
    ),
  );

  const aprovar = useMutation({
    mutationFn: async () => {
      const payload = Object.entries(precos).map(([produto_id, valor]) => {
        const preco = Number(valor.replace(",", "."));
        if (!Number.isFinite(preco) || preco < 0) {
          throw new Error("Confira os valores de revenda: use números maiores ou iguais a zero.");
        }
        return { produto_id, preco_venda: preco };
      });
      const { error } = await supabase.rpc("aprovar_entrada_nota", {
        p_compra_id: entrada.id,
        p_precos: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        entrada.recebido_em
          ? "Valor de revenda confirmado."
          : "Entrada aprovada e lançada no estoque.",
      );
      onAprovada();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nomeFornecedor =
    entrada.fornecedor?.nome_fantasia || entrada.fornecedor?.razao_social || "Fornecedor";

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
        <span>
          <strong>{nomeFornecedor}</strong> · NF {entrada.numero_nota ?? "—"} · série{" "}
          {entrada.serie_nota ?? "—"} · {dataHoraBR(entrada.created_at)}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {entrada.recebido_em
            ? "Já no estoque: confirme o valor"
            : "Aguardando entrada no estoque"}
        </span>
        <span className="font-semibold">{brl(entrada.valor_total)}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Produto</th>
              <th className="px-4 py-2 text-right">Qtd</th>
              <th className="px-4 py-2 text-right">Custo</th>
              <th className="px-4 py-2 text-right">Valor de revenda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entrada.itens.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 font-medium">{item.descricao}</td>
                <td className="px-4 py-2 text-right">{item.quantidade}</td>
                <td className="px-4 py-2 text-right">{brl(item.custo_unitario)}</td>
                <td className="px-4 py-2 text-right">
                  {item.produto_id ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label={`Valor de revenda de ${item.descricao}`}
                      value={precos[item.produto_id] ?? ""}
                      onChange={(e) =>
                        setPrecos((p) => ({ ...p, [item.produto_id as string]: e.target.value }))
                      }
                      className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-right text-xs"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">sem produto</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-4 py-3">
        <Button onClick={() => aprovar.mutate()} disabled={aprovar.isPending}>
          {aprovar.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PackageCheck className="h-4 w-4" />
          )}
          {entrada.recebido_em ? "Confirmar valores" : "Aprovar e lançar no estoque"}
        </Button>
      </div>
    </div>
  );
}
