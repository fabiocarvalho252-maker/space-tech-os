import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { somenteDigitos } from "@/lib/documento";
import { dataHoraBR } from "@/lib/format";
import { lerXmlNota, type NotaEntrada } from "@/lib/nota-entrada/nfe-xml";
import { sugerirProduto, type ProdutoCadastrado } from "@/lib/nota-entrada/casar-itens";
import { montarItensImportacao, type LinhaImportacao } from "@/lib/nota-entrada/montar-itens";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CADASTRAR_NOVO = "__novo__";

type FornecedorNota = { id: string; razao_social: string; cnpj_cpf: string | null };

type NotaSalva = {
  id: string;
  chave_acesso: string | null;
  numero_nota: string | null;
  serie_nota: string | null;
  data_emissao: string | null;
  valor_total: number;
  created_at: string;
};

type Rascunho = { nota: NotaEntrada; linhas: LinhaImportacao[] };

export function NotasEntradaDialog({
  open,
  onOpenChange,
  fornecedor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedor: FornecedorNota | null;
}) {
  const qc = useQueryClient();
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const fornecedorId = fornecedor?.id ?? "";

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas-fornecedor", fornecedorId],
    enabled: open && !!fornecedorId,
    queryFn: async (): Promise<NotaSalva[]> => {
      const { data, error } = await supabase
        .from("compras")
        .select("id, chave_acesso, numero_nota, serie_nota, data_emissao, valor_total, created_at")
        .eq("fornecedor_id", fornecedorId)
        .not("chave_acesso", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NotaSalva[];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-nota-entrada"],
    enabled: open,
    queryFn: async (): Promise<ProdutoCadastrado[]> => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, codigo_barras, sku")
        .neq("categoria", "Serviço")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  async function lerArquivo(arquivo: File) {
    try {
      const nota = lerXmlNota(await arquivo.text());
      if (nota.chave && notas.some((n) => n.chave_acesso === nota.chave)) {
        toast.error("Esta nota fiscal já foi importada para este fornecedor.");
        return;
      }
      const linhas = nota.itens.map((item) => ({
        item,
        produtoId: sugerirProduto(item, produtos)?.id ?? null,
      }));
      setRascunho({ nota, linhas });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function definirProduto(indice: number, valor: string) {
    setRascunho((r) => {
      if (!r) return r;
      const linhas = r.linhas.map((l, i) =>
        i === indice ? { ...l, produtoId: valor === CADASTRAR_NOVO ? null : valor } : l,
      );
      return { ...r, linhas };
    });
  }

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!rascunho || !fornecedor) throw new Error("Nenhuma nota carregada.");
      const { nota, linhas } = rascunho;
      const { error } = await supabase.rpc("importar_nota_compra", {
        p_fornecedor_id: fornecedor.id,
        p_chave_acesso: nota.chave,
        p_numero_nota: nota.numero,
        p_serie_nota: nota.serie,
        p_data_emissao: nota.dataEmissao,
        p_itens: montarItensImportacao(linhas),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota lançada no estoque.");
      setRascunho(null);
      qc.invalidateQueries({ queryKey: ["notas-fornecedor", fornecedorId] });
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["produtos-compras"] });
      qc.invalidateQueries({ queryKey: ["produtos-nota-entrada"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cnpjDiferente =
    rascunho &&
    fornecedor?.cnpj_cpf &&
    somenteDigitos(rascunho.nota.emitente.cnpj) !== somenteDigitos(fornecedor.cnpj_cpf);

  function fechar(v: boolean) {
    onOpenChange(v);
    if (!v) setRascunho(null);
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Notas de entrada — {fornecedor?.razao_social}</DialogTitle>
          <DialogDescription>
            Importe o XML da NF-e de compra. Os itens entram no estoque ao confirmar.
          </DialogDescription>
        </DialogHeader>

        {!rascunho && (
          <>
            <Label
              htmlFor="arquivo-nota-xml"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              <FileUp className="h-4 w-4" /> Selecionar XML da nota
            </Label>
            <input
              id="arquivo-nota-xml"
              type="file"
              accept=".xml,text/xml,application/xml"
              className="sr-only"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) lerArquivo(arquivo);
              }}
            />

            <h3 className="pt-2 text-sm font-semibold">Notas já lançadas</h3>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !notas.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma nota importada deste fornecedor.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                {notas.map((n) => (
                  <li key={n.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span>
                      NF {n.numero_nota ?? "—"} · série {n.serie_nota ?? "—"} ·{" "}
                      {dataHoraBR(n.data_emissao ?? n.created_at)}
                    </span>
                    <span className="font-semibold">{brl(n.valor_total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {rascunho && (
          <>
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
              NF <strong>{rascunho.nota.numero || "—"}</strong> · série {rascunho.nota.serie || "—"} ·
              emitente {rascunho.nota.emitente.nome} · {rascunho.linhas.length} item(ns) ·{" "}
              <strong>{brl(rascunho.nota.valorTotal)}</strong>
            </div>

            {cnpjDiferente && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                O CNPJ da nota ({rascunho.nota.emitente.cnpj}) é diferente do cadastro deste fornecedor.
                Confira antes de confirmar.
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Item da nota</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2">Lançar em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rascunho.linhas.map((l, i) => (
                    <tr key={`${l.item.numero}-${i}`}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.item.descricao}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.item.codigo}
                          {l.item.ean ? ` · EAN ${l.item.ean}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {l.item.quantidade} {l.item.unidade}
                      </td>
                      <td className="px-3 py-2 text-right">{brl(l.item.custoUnitario)}</td>
                      <td className="px-3 py-2">
                        <select
                          value={l.produtoId ?? CADASTRAR_NOVO}
                          onChange={(e) => definirProduto(i, e.target.value)}
                          className="h-8 w-full max-w-xs rounded-lg border border-input bg-background px-2 text-xs"
                        >
                          <option value={CADASTRAR_NOVO}>+ Cadastrar como produto novo</option>
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRascunho(null)}>
                Voltar
              </Button>
              <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
                {confirmar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar e lançar no estoque
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
