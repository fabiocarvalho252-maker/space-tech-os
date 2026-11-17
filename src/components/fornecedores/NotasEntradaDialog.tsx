import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { somenteDigitos } from "@/lib/documento";
import { dataHoraBR } from "@/lib/format";
import { lerXmlNota, type NotaEntrada } from "@/lib/nota-entrada/nfe-xml";
import { sugerirProduto, type ProdutoCadastrado } from "@/lib/nota-entrada/casar-itens";
import {
  montarItensImportacao,
  precoComMargem,
  type LinhaImportacao,
} from "@/lib/nota-entrada/montar-itens";
import { imagemParaJpegBase64 } from "@/lib/nota-entrada/imagem";
import { lerNotaFotoIA } from "@/lib/nota-entrada/nota-foto.functions";
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

type Rascunho = { nota: NotaEntrada; linhas: LinhaImportacao[]; origem: "xml" | "foto" };

const MAX_FOTOS = 4;

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
  const [lendoFoto, setLendoFoto] = useState(false);
  const [margemTexto, setMargemTexto] = useState("");

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
        .select("id, nome, codigo_barras, sku, preco_venda")
        .neq("categoria", "Serviço")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Preço de venda atual do produto: aparece no campo de revenda para ser revisto.
  function precoAtual(produtoId: string | null): number | null {
    if (!produtoId) return null;
    return produtos.find((p) => p.id === produtoId)?.preco_venda ?? null;
  }

  function prepararRascunho(nota: NotaEntrada, origem: Rascunho["origem"]) {
    if (nota.chave && notas.some((n) => n.chave_acesso === nota.chave)) {
      toast.error("Esta nota fiscal já foi importada para este fornecedor.");
      return;
    }
    const linhas: LinhaImportacao[] = nota.itens.map((item) => {
      const produtoId = sugerirProduto(item, produtos)?.id ?? null;
      return { item, produtoId, precoVenda: precoAtual(produtoId) };
    });
    setRascunho({ nota, linhas, origem });
  }

  async function lerArquivo(arquivo: File) {
    try {
      prepararRascunho(lerXmlNota(await arquivo.text()), "xml");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function lerFotos(arquivos: File[]) {
    if (arquivos.length > MAX_FOTOS) {
      toast.error(`Envie no máximo ${MAX_FOTOS} fotos da mesma nota.`);
      return;
    }
    setLendoFoto(true);
    try {
      const imagens = await Promise.all(arquivos.map(imagemParaJpegBase64));
      const nota = await lerNotaFotoIA({ data: { imagens } });
      prepararRascunho(nota, "foto");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLendoFoto(false);
    }
  }

  function atualizarLinha(indice: number, mudanca: Partial<LinhaImportacao>) {
    setRascunho((r) => {
      if (!r) return r;
      const linhas = r.linhas.map((l, i) => (i === indice ? { ...l, ...mudanca } : l));
      return { ...r, linhas };
    });
  }

  function definirProduto(indice: number, valor: string) {
    const produtoId = valor === CADASTRAR_NOVO ? null : valor;
    atualizarLinha(indice, { produtoId, precoVenda: precoAtual(produtoId) });
  }

  // Campo vazio vira null: produto novo fica com 0; produto existente mantém o preço atual.
  function definirPrecoVenda(indice: number, valor: string) {
    const texto = valor.replace(",", ".").trim();
    const numero = texto === "" ? null : Number(texto);
    atualizarLinha(indice, {
      precoVenda: numero !== null && Number.isFinite(numero) && numero >= 0 ? numero : null,
    });
  }

  function aplicarMargem() {
    const margem = Number(margemTexto.replace(",", "."));
    if (!Number.isFinite(margem) || margem < 0) {
      toast.error("Informe uma margem em % (0 ou mais).");
      return;
    }
    setRascunho((r) => {
      if (!r) return r;
      const linhas = r.linhas.map((l) => ({
        ...l,
        precoVenda: precoComMargem(l.item.custoUnitario, margem),
      }));
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
      toast.success("Produtos lançados. Aprove a entrada na aba Produtos para entrar no estoque.");
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
            Importe o XML da NF-e ou leia a nota por foto. Os produtos ficam na aba Produtos
            aguardando aprovação; o estoque só muda quando você aprovar.
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

            <Label
              htmlFor="foto-nota"
              aria-disabled={lendoFoto}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground hover:border-primary hover:text-primary"
            >
              {lendoFoto ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Lendo a nota...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" /> Fotografar ou escanear a nota (até {MAX_FOTOS}{" "}
                  fotos)
                </>
              )}
            </Label>
            <input
              id="foto-nota"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              disabled={lendoFoto}
              onChange={(e) => {
                const arquivos = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (arquivos.length) lerFotos(arquivos);
              }}
            />

            <h3 className="pt-2 text-sm font-semibold">Notas já lançadas</h3>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !notas.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma nota importada deste fornecedor.
              </p>
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
              NF <strong>{rascunho.nota.numero || "—"}</strong> · série {rascunho.nota.serie || "—"}{" "}
              · emitente {rascunho.nota.emitente.nome} · {rascunho.linhas.length} item(ns) ·{" "}
              <strong>{brl(rascunho.nota.valorTotal)}</strong>
            </div>

            {rascunho.origem === "foto" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                Lido por foto: confira cada quantidade e custo com a nota antes de confirmar.
              </div>
            )}

            {cnpjDiferente && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />O CNPJ da nota (
                {rascunho.nota.emitente.cnpj}) é diferente do cadastro deste fornecedor. Confira
                antes de confirmar.
              </div>
            )}

            <div className="flex flex-wrap items-end gap-2 text-sm">
              <div className="space-y-1">
                <Label htmlFor="margem-revenda" className="text-xs">
                  Margem sobre o custo (%)
                </Label>
                <input
                  id="margem-revenda"
                  inputMode="decimal"
                  value={margemTexto}
                  onChange={(e) => setMargemTexto(e.target.value)}
                  placeholder="ex.: 80"
                  className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-xs"
                />
              </div>
              <Button size="sm" variant="outline" onClick={aplicarMargem}>
                Preencher revenda de todos os itens
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Item da nota</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2">Lançar em</th>
                    <th className="px-3 py-2 text-right">Valor de revenda</th>
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
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          aria-label={`Valor de revenda de ${l.item.descricao}`}
                          value={l.precoVenda ?? ""}
                          placeholder="0,00"
                          onChange={(e) => definirPrecoVenda(i, e.target.value)}
                          className="h-8 w-28 rounded-lg border border-input bg-background px-2 text-right text-xs"
                        />
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
                Lançar produtos (aguarda aprovação)
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
