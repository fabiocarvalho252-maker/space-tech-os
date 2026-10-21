// Novo contrato de crediário: cliente, aparelho, condições e aceite do termo
// de bloqueio, com a prévia das parcelas ao lado. Grava tudo de uma vez via
// criar_contrato_crediario() (contrato + parcelas + lançamentos no
// Financeiro numa única transação).
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { dataBR } from "@/lib/format";
import { hojeISO, imeiValido, previaParcelas, somarMeses, termoBloqueio } from "@/lib/crediario";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MoneyInput } from "@/components/MoneyInput";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SEM_FORMA = "__nenhuma__";

function vazio() {
  return {
    clienteId: "",
    marca: "",
    modelo: "",
    imei: "",
    valorAparelho: 0,
    entrada: 0,
    formaEntradaId: SEM_FORMA,
    numParcelas: "6",
    parcelaFixa: false,
    valorParcela: 0,
    primeiroVencimento: somarMeses(hojeISO(), 1),
    multaPct: "2",
    jurosMesPct: "1",
    diasTolerancia: "1",
    observacoes: "",
    termoAceito: false,
  };
}

export function NovoContratoModal({
  open,
  onOpenChange,
  empresaId,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  onCriado: (contratoId: string) => void;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [form, setForm] = useState(vazio);
  const set = <K extends keyof ReturnType<typeof vazio>>(k: K, v: ReturnType<typeof vazio>[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (open) setForm(vazio());
  }, [open]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["payment-methods", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("id, nome")
        .eq("user_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const imei = form.imei.replace(/\D/g, "");
  const numParcelas = Number(form.numParcelas) || 0;
  const financiado = Math.max(form.valorAparelho - form.entrada, 0);
  const parcelas = useMemo(
    () =>
      previaParcelas(
        form.valorAparelho,
        form.entrada,
        numParcelas,
        form.parcelaFixa ? form.valorParcela : null,
      ),
    [form.valorAparelho, form.entrada, numParcelas, form.parcelaFixa, form.valorParcela],
  );
  const totalParcelas = parcelas.reduce((s, v) => s + v, 0);
  const jurosFinanciamento = form.parcelaFixa ? totalParcelas - financiado : 0;

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.clienteId) throw new Error("Selecione o cliente.");
      if (imei.length !== 15) throw new Error("O IMEI precisa ter 15 dígitos.");
      if (!form.termoAceito) throw new Error("O cliente precisa aceitar o termo de bloqueio.");
      const { data, error } = await supabase.rpc("criar_contrato_crediario", {
        p_cliente_id: form.clienteId,
        p_marca: form.marca,
        p_modelo: form.modelo,
        p_imei: imei,
        p_valor_aparelho: form.valorAparelho,
        p_entrada: form.entrada,
        p_num_parcelas: numParcelas,
        p_primeiro_vencimento: form.primeiroVencimento,
        p_termo_aceito: form.termoAceito,
        p_multa_pct: Number(form.multaPct),
        p_juros_mes_pct: Number(form.jurosMesPct),
        p_dias_tolerancia: Number(form.diasTolerancia),
        ...(form.parcelaFixa ? { p_valor_parcela: form.valorParcela } : {}),
        ...(form.formaEntradaId === SEM_FORMA ? {} : { p_forma_entrada_id: form.formaEntradaId }),
        ...(form.observacoes ? { p_observacoes: form.observacoes } : {}),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (contrato) => {
      toast.success("Contrato de crediário criado.");
      qc.invalidateQueries({ queryKey: ["crediario"] });
      qc.invalidateQueries({ queryKey: ["lancamentos"] });
      onOpenChange(false);
      onCriado(contrato.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo contrato de crediário</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[1fr_15rem]">
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-bold">Cliente e aparelho</h3>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={form.clienteId} onValueChange={(v) => set("clienteId", v)}>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Marca</Label>
                  <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo</Label>
                  <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>IMEI</Label>
                <Input
                  inputMode="numeric"
                  placeholder="15 dígitos (*#06# no aparelho)"
                  value={form.imei}
                  onChange={(e) => set("imei", e.target.value)}
                />
                {imei.length === 15 && !imeiValido(imei) && (
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" /> Dígito verificador não confere — confira o
                    IMEI.
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-bold">Valores</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Valor do aparelho</Label>
                  <MoneyInput
                    value={form.valorAparelho}
                    onChange={(v) => set("valorAparelho", v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Entrada</Label>
                  <MoneyInput value={form.entrada} onChange={(v) => set("entrada", v)} />
                </div>
              </div>
              {form.entrada > 0 && (
                <div className="space-y-1.5">
                  <Label>Forma de pagamento da entrada</Label>
                  <Select
                    value={form.formaEntradaId}
                    onValueChange={(v) => set("formaEntradaId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_FORMA}>Não informar</SelectItem>
                      {formasPagamento.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Parcelas</Label>
                  <Select value={form.numParcelas} onValueChange={(v) => set("numParcelas", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => String(i + 1)).map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>1º vencimento</Label>
                  <Input
                    type="date"
                    min={hojeISO()}
                    value={form.primeiroVencimento}
                    onChange={(e) => set("primeiroVencimento", e.target.value)}
                  />
                </div>
              </div>
              <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={form.parcelaFixa}
                  onCheckedChange={(v) => set("parcelaFixa", v === true)}
                />
                Definir valor da parcela (com juros do financiamento)
              </label>
              {form.parcelaFixa && (
                <div className="space-y-1.5">
                  <Label>Valor de cada parcela</Label>
                  <MoneyInput value={form.valorParcela} onChange={(v) => set("valorParcela", v)} />
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-bold">Atraso e bloqueio</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Multa (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={form.multaPct}
                    onChange={(e) => set("multaPct", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Juros ao mês (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min={0}
                    max={1}
                    value={form.jurosMesPct}
                    onChange={(e) => set("jurosMesPct", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bloquear após (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={form.diasTolerancia}
                    onChange={(e) => set("diasTolerancia", e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Pelo Código de Defesa do Consumidor a multa por atraso é limitada a 2% e os juros de
                mora a 1% ao mês.
              </p>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => set("observacoes", e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-bold">Termo de bloqueio</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {termoBloqueio(Number(form.diasTolerancia) || 1)}
              </p>
              <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={form.termoAceito}
                  onCheckedChange={(v) => set("termoAceito", v === true)}
                />
                O cliente leu e aceitou o termo
              </label>
            </section>
          </div>

          <aside className="h-fit space-y-3 rounded-xl border border-border bg-secondary/20 p-4 md:sticky md:top-0">
            <h3 className="text-sm font-bold">Resumo</h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Aparelho</dt>
                <dd>{brl(form.valorAparelho)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Entrada</dt>
                <dd>{brl(form.entrada)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Financiado</dt>
                <dd>{brl(financiado)}</dd>
              </div>
              {form.parcelaFixa && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Juros</dt>
                  <dd className={jurosFinanciamento < -0.01 ? "text-destructive" : ""}>
                    {brl(jurosFinanciamento)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-1 font-bold">
                <dt>Total a prazo</dt>
                <dd>{brl(form.entrada + totalParcelas)}</dd>
              </div>
            </dl>
            {parcelas.length > 0 && (
              <ol className="max-h-56 space-y-1 overflow-y-auto border-t border-border pt-2 text-xs">
                {parcelas.map((v, i) => (
                  <li key={i} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {i + 1}/{parcelas.length} · {dataBR(somarMeses(form.primeiroVencimento, i))}
                    </span>
                    <span className="font-medium">{brl(v)}</span>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => criar.mutate()} disabled={criar.isPending || !form.termoAceito}>
            {criar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
