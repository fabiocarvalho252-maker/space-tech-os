// "Vender aparelho" (pedido, seções 12/50): coleta cliente/pagamento/
// garantia num único formulário com resumo lateral (em vez de um wizard de
// telas separadas — mesmo espírito, menos cliques) e chama a função
// Postgres vender_aparelho(), a única operação atômica real que o
// PostgREST consegue oferecer (ver a migration). Depois de vendida, mostra
// a tela de sucesso com os atalhos pedidos na seção 48.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { base64ParaBytes, sanitizarNomeArquivo } from "@/lib/pdf-share";
import { gerarComprovanteAparelhoCompartilharFn } from "@/lib/aparelhos/aparelhos.functions";
import { PdfPreviewDialog, type PdfGerado } from "./PdfPreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type AparelhoRow = Database["public"]["Tables"]["aparelhos"]["Row"];

const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Débito", "Crédito", "Transferência", "Outros"];

export function VenderAparelhoModal({
  open,
  onOpenChange,
  aparelho,
  empresaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aparelho: AparelhoRow | null;
  empresaId: string;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [clienteId, setClienteId] = useState("");
  const [precoVenda, setPrecoVenda] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [termoId, setTermoId] = useState("");
  const [diasGarantia, setDiasGarantia] = useState("90");
  const [observacoes, setObservacoes] = useState("");
  const [resultado, setResultado] = useState<{ vendaId: string; clienteNome: string } | null>(null);

  useEffect(() => {
    if (open && aparelho) {
      setClienteId("");
      setPrecoVenda(Number(aparelho.preco_venda ?? 0));
      setDesconto(0);
      setFormaPagamento("PIX");
      setTermoId("");
      setDiasGarantia("90");
      setObservacoes("");
      setResultado(null);
    }
  }, [open, aparelho]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-aparelhos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: termos = [] } = useQuery({
    queryKey: ["termos-garantia-aparelhos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termos_garantia")
        .select("id, titulo, is_default")
        .eq("ativo", true)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!termoId && termos.length) {
      const padrao = termos.find((t) => t.is_default) ?? termos[0];
      if (padrao) setTermoId(padrao.id);
    }
  }, [termos, termoId]);

  const vender = useMutation({
    mutationFn: async () => {
      if (!aparelho) throw new Error("Nenhum aparelho selecionado.");
      if (!clienteId) throw new Error("Selecione o cliente.");
      const dias = Number(diasGarantia) || 0;
      const { data, error } = await supabase.rpc("vender_aparelho", {
        p_aparelho_id: aparelho.id,
        p_cliente_id: clienteId,
        p_preco_venda: precoVenda,
        p_desconto: desconto,
        p_forma_pagamento: formaPagamento,
        ...(termoId ? { p_termo_garantia_id: termoId } : {}),
        ...(dias > 0 ? { p_dias_garantia: dias } : {}),
        ...(observacoes.trim() ? { p_observacoes: observacoes.trim() } : {}),
      });
      if (error) throw error;
      const { data: itemVenda } = await supabase
        .from("venda_itens")
        .select("venda_id")
        .eq("aparelho_id", aparelho.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const cliente = clientes.find((c) => c.id === clienteId);
      return {
        aparelho: data,
        vendaId: itemVenda?.venda_id as string,
        clienteNome: cliente?.nome ?? "Cliente",
      };
    },
    onSuccess: (r) => {
      toast.success("Venda realizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      qc.invalidateQueries({ queryKey: ["aparelho-historico"] });
      setResultado({ vendaId: r.vendaId, clienteNome: r.clienteNome });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pdfDialogAberto, setPdfDialogAberto] = useState(false);
  const [pdf, setPdf] = useState<PdfGerado | null>(null);

  const compartilhar = useMutation({
    mutationFn: async () => {
      if (!resultado || !aparelho) throw new Error("Venda não encontrada.");
      const { base64 } = await gerarComprovanteAparelhoCompartilharFn({
        data: { vendaId: resultado.vendaId },
      });
      const nome = `COMPROVANTE-${sanitizarNomeArquivo(aparelho.marca + " " + aparelho.modelo)}-${sanitizarNomeArquivo(resultado.clienteNome)}.pdf`;
      return new File([base64ParaBytes(base64)], nome, { type: "application/pdf" });
    },
    onSuccess: (file) => setPdf({ file, url: URL.createObjectURL(file) }),
    onError: (e: Error) => toast.error("Erro ao gerar comprovante: " + e.message),
  });

  function abrirComprovante() {
    setPdf(null);
    setPdfDialogAberto(true);
    compartilhar.mutate();
  }

  function fecharPdfDialog(v: boolean) {
    if (!v && pdf) URL.revokeObjectURL(pdf.url);
    setPdfDialogAberto(v);
  }

  const valorFinal = Math.max(precoVenda - desconto, 0);

  if (!aparelho) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{resultado ? "Venda concluída" : "Vender aparelho"}</DialogTitle>
        </DialogHeader>

        {resultado ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <div>
              <p className="text-lg font-bold">Venda realizada com sucesso!</p>
              <p className="text-sm text-muted-foreground">
                {aparelho.marca} {aparelho.modelo} vendido para {resultado.clienteNome}.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={abrirComprovante}
                disabled={compartilhar.isPending}
              >
                {compartilhar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Gerar comprovante"
                )}
              </Button>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </div>

            <PdfPreviewDialog
              open={pdfDialogAberto}
              onOpenChange={fecharPdfDialog}
              titulo="Comprovante de venda"
              gerando={compartilhar.isPending}
              pdf={pdf}
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1.3fr_1fr]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Valor de venda *</Label>
                  <MoneyInput value={precoVenda} onChange={setPrecoVenda} />
                </div>
                <div className="space-y-1.5">
                  <Label>Desconto</Label>
                  <MoneyInput value={desconto} onChange={setDesconto} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Modelo de garantia</Label>
                  <Select value={termoId} onValueChange={setTermoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem garantia" />
                    </SelectTrigger>
                    <SelectContent>
                      {termos.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dias de garantia</Label>
                  <Input
                    type="number"
                    min={0}
                    value={diasGarantia}
                    onChange={(e) => setDiasGarantia(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4 text-sm">
              <p className="font-semibold text-foreground">
                {aparelho.marca} {aparelho.modelo}
              </p>
              <p className="text-xs text-muted-foreground">
                {aparelho.tipo === "lacrado" ? "Lacrado" : "Seminovo"}
                {aparelho.imei1 ? ` · IMEI final ${aparelho.imei1.slice(-4)}` : ""}
              </p>
              <div className="space-y-1 border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preço</span>
                  <span>{brl(precoVenda)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto</span>
                  <span>{brl(desconto)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1 font-bold">
                  <span>Total</span>
                  <span>{brl(valorFinal)}</span>
                </div>
              </div>
              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                <p>Pagamento: {formaPagamento}</p>
                <p>Garantia: {diasGarantia || 0} dias</p>
              </div>
              <Button
                className="mt-2 w-full"
                onClick={() => vender.mutate()}
                disabled={vender.isPending || !clienteId}
              >
                {vender.isPending ? "Confirmando..." : "Confirmar venda"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
