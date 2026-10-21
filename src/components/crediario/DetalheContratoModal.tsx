// Detalhe de um contrato de crediário: parcelas (com valor atualizado e
// recebimento), situação do aparelho (bloquear/liberar manualmente), fila
// de comandos para o app e linha do tempo. Toda ação chama uma função
// Postgres que revalida permissão e regras — os botões escondidos aqui são
// só conveniência.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Loader2, Lock, LockOpen, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { dataBR } from "@/lib/format";
import {
  TIPO_COMANDO,
  hojeISO,
  numeroContrato,
  statusAparelho as infoAparelho,
  statusComando,
  statusContrato,
  statusParcela,
} from "@/lib/crediario";
import { StatusBadge } from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/EmptyState";
import { MoneyInput } from "@/components/MoneyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { Database } from "@/integrations/supabase/types";

type Parcela = Database["public"]["Views"]["vw_crediario_parcelas"]["Row"];
type Acao = "bloquear" | "liberar" | "cancelar";

const SEM_FORMA = "__nenhuma__";

export function DetalheContratoModal({
  contratoId,
  onOpenChange,
  empresaId,
  gerenciar,
}: {
  contratoId: string | null;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  gerenciar: boolean;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const open = !!contratoId;
  const [parcelaReceber, setParcelaReceber] = useState<Parcela | null>(null);
  const [acao, setAcao] = useState<Acao | null>(null);

  const { data: contrato } = useQuery({
    queryKey: ["crediario", "contrato", contratoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_crediario_contratos")
        .select("*")
        .eq("id", contratoId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: parcelas = [], isLoading: carregandoParcelas } = useQuery({
    queryKey: ["crediario", "parcelas", contratoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_crediario_parcelas")
        .select("*")
        .eq("contrato_id", contratoId!)
        .order("numero");
      if (error) throw error;
      return data;
    },
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ["crediario", "eventos", contratoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crediario_eventos")
        .select("id, descricao, created_at")
        .eq("contrato_id", contratoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: comandos = [] } = useQuery({
    queryKey: ["crediario", "comandos", contratoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crediario_comandos")
        .select("id, tipo, status, motivo, created_at, confirmado_em")
        .eq("contrato_id", contratoId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const encerrado = contrato?.status === "quitado" || contrato?.status === "cancelado";
  const status = statusContrato(contrato?.status);
  const statusAparelho = infoAparelho(contrato?.status_aparelho);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {numeroContrato(contrato?.numero)}
              {contrato && <StatusBadge label={status.label} tone={status.tone} />}
            </DialogTitle>
            <DialogDescription>
              {contrato?.cliente_nome ?? "—"}
              {contrato?.cliente_telefone ? ` · ${contrato.cliente_telefone}` : ""}
            </DialogDescription>
          </DialogHeader>

          {!contrato ? (
            <TableSkeleton linhas={4} />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-xl border border-border p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <Smartphone className="h-4 w-4" /> Aparelho
                  </h3>
                  <p className="font-semibold">
                    {contrato.marca} {contrato.modelo}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">IMEI {contrato.imei}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={statusAparelho.label}
                      tone={statusAparelho.tone}
                      icon={contrato.status_aparelho === "bloqueado" ? Lock : LockOpen}
                    />
                    {contrato.bloqueio_manual && (
                      <StatusBadge label="Bloqueio manual" tone="purple" />
                    )}
                    {contrato.liberado_ate && (
                      <StatusBadge
                        label={`Liberado até ${dataBR(contrato.liberado_ate)}`}
                        tone="info"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {contrato.provisionado_em
                      ? `App de proteção ativo · último contato ${
                          contrato.ultimo_contato
                            ? new Date(contrato.ultimo_contato).toLocaleString("pt-BR")
                            : "—"
                        }`
                      : "App de proteção ainda não instalado: os comandos ficam na fila até o aparelho se conectar."}
                  </p>
                  {gerenciar && !encerrado && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {contrato.status_aparelho === "bloqueado" ? (
                        <Button size="sm" variant="outline" onClick={() => setAcao("liberar")}>
                          <LockOpen className="h-4 w-4" /> Liberar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setAcao("bloquear")}>
                          <Lock className="h-4 w-4" /> Bloquear
                        </Button>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-border p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <Wallet className="h-4 w-4" /> Condições
                  </h3>
                  <dl className="space-y-1 text-sm">
                    <Linha rotulo="Valor do aparelho" valor={brl(contrato.valor_aparelho)} />
                    <Linha rotulo="Entrada" valor={brl(contrato.entrada)} />
                    <Linha
                      rotulo="Parcelas"
                      valor={`${contrato.parcelas_pagas ?? 0}/${contrato.num_parcelas} pagas`}
                    />
                    <Linha rotulo="Recebido em parcelas" valor={brl(contrato.total_recebido)} />
                    <Linha rotulo="Saldo devedor" valor={brl(contrato.saldo_devedor)} forte />
                    <Linha
                      rotulo="Multa / juros"
                      valor={`${contrato.multa_pct}% / ${contrato.juros_mes_pct}% a.m.`}
                    />
                    <Linha
                      rotulo="Bloqueio após"
                      valor={`${contrato.dias_tolerancia} dia(s) de atraso`}
                    />
                  </dl>
                </section>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-bold">Parcelas</h3>
                {carregandoParcelas ? (
                  <TableSkeleton linhas={3} />
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2">Nº</th>
                          <th className="px-3 py-2">Vencimento</th>
                          <th className="px-3 py-2">Valor</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {parcelas.map((p) => {
                          const st = statusParcela(p.status);
                          const emAberto = p.status === "aberta" || p.status === "atrasada";
                          return (
                            <tr key={p.id} className="border-b border-border/60 last:border-0">
                              <td className="px-3 py-2">
                                {p.numero}/{contrato.num_parcelas}
                              </td>
                              <td className="px-3 py-2">{dataBR(p.vencimento)}</td>
                              <td className="px-3 py-2">
                                {p.status === "paga" ? (
                                  <>
                                    {brl(p.valor_pago)}
                                    <span className="block text-xs text-muted-foreground">
                                      pago em {dataBR(p.pago_em)}
                                    </span>
                                  </>
                                ) : emAberto &&
                                  Number(p.valor_atualizado) > Number(p.valor) + 0.001 ? (
                                  <>
                                    {brl(p.valor_atualizado)}
                                    <span className="block text-xs text-muted-foreground">
                                      original {brl(p.valor)}
                                    </span>
                                  </>
                                ) : (
                                  brl(p.valor)
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge
                                  label={
                                    p.status === "atrasada"
                                      ? `${st.label} · ${p.dias_atraso}d`
                                      : st.label
                                  }
                                  tone={st.tone}
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                {gerenciar && emAberto && contrato.status !== "cancelado" && (
                                  <Button size="sm" onClick={() => setParcelaReceber(p)}>
                                    Receber
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-sm font-bold">Histórico</h3>
                  <ol className="space-y-2 border-l border-border pl-4 text-sm">
                    {eventos.map((e) => (
                      <li key={e.id}>
                        <p>{e.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-bold">Comandos para o aparelho</h3>
                  {comandos.length ? (
                    <ul className="space-y-2 text-sm">
                      {comandos.map((k) => {
                        const st = statusComando(k.status);
                        return (
                          <li
                            key={k.id}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              <span className="font-medium">{TIPO_COMANDO[k.tipo] ?? k.tipo}</span>
                              <span className="block text-xs text-muted-foreground">
                                {k.motivo} · {new Date(k.created_at).toLocaleString("pt-BR")}
                              </span>
                            </span>
                            <StatusBadge label={st.label} tone={st.tone} />
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum comando ainda.</p>
                  )}
                </section>
              </div>

              {contrato.observacoes && (
                <section>
                  <h3 className="mb-1 text-sm font-bold">Observações</h3>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {contrato.observacoes}
                  </p>
                </section>
              )}

              {gerenciar && !encerrado && (
                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => setAcao("cancelar")}
                  >
                    <Ban className="h-4 w-4" /> Cancelar contrato
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceberParcelaDialog
        parcela={parcelaReceber}
        numParcelas={contrato?.num_parcelas ?? 0}
        empresaId={empresaId}
        onClose={() => setParcelaReceber(null)}
        onFeito={() => qc.invalidateQueries({ queryKey: ["crediario"] })}
      />

      <AcaoContratoDialog
        acao={acao}
        contratoId={contratoId}
        temAtraso={(contrato?.dias_atraso ?? 0) > 0}
        onClose={() => setAcao(null)}
        onFeito={() => qc.invalidateQueries({ queryKey: ["crediario"] })}
      />
    </>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${forte ? "font-bold" : ""}`}>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-right">{valor}</dd>
    </div>
  );
}

function ReceberParcelaDialog({
  parcela,
  numParcelas,
  empresaId,
  onClose,
  onFeito,
}: {
  parcela: Parcela | null;
  numParcelas: number;
  empresaId: string;
  onClose: () => void;
  onFeito: () => void;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hojeISO());
  const [formaId, setFormaId] = useState(SEM_FORMA);
  const [dispensar, setDispensar] = useState(false);

  const original = Number(parcela?.valor ?? 0);
  const atualizado = Number(parcela?.valor_atualizado ?? original);
  const temEncargos = atualizado > original + 0.001;

  useEffect(() => {
    if (parcela) {
      setValor(atualizado);
      setData(hojeISO());
      setFormaId(SEM_FORMA);
      setDispensar(false);
    }
  }, [parcela, atualizado]);

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["payment-methods", empresaId],
    enabled: !!empresaId && !!parcela,
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

  const receber = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("registrar_pagamento_crediario", {
        p_parcela_id: parcela!.id!,
        p_valor: valor,
        p_data: data,
        p_dispensar_encargos: dispensar,
        ...(formaId === SEM_FORMA ? {} : { p_payment_method_id: formaId }),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      onFeito();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!parcela} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Receber parcela {parcela?.numero}/{numParcelas}
          </DialogTitle>
          <DialogDescription>
            Vencimento {dataBR(parcela?.vencimento)} · valor original {brl(original)}
            {temEncargos && ` · atualizado hoje ${brl(atualizado)}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor recebido</Label>
              <MoneyInput value={valor} onChange={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                max={hojeISO()}
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={formaId} onValueChange={setFormaId}>
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
          {temEncargos && (
            <label className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={dispensar}
                onCheckedChange={(v) => {
                  setDispensar(v === true);
                  setValor(v === true ? original : atualizado);
                }}
              />
              Dispensar multa e juros
            </label>
          )}
          {data !== hojeISO() && temEncargos && (
            <p className="text-xs text-muted-foreground">
              Com data retroativa, multa e juros são recalculados até a data informada.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => receber.mutate()} disabled={receber.isPending || valor <= 0}>
            {receber.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TEXTO_ACAO: Record<Acao, { titulo: string; descricao: string; botao: string }> = {
  bloquear: {
    titulo: "Bloquear aparelho",
    descricao:
      "O aparelho fica bloqueado até alguém liberar manualmente, mesmo com as parcelas em dia.",
    botao: "Bloquear",
  },
  liberar: {
    titulo: "Liberar aparelho",
    descricao:
      "Se houver parcela em atraso, o aparelho volta a ser bloqueado automaticamente depois da data informada.",
    botao: "Liberar",
  },
  cancelar: {
    titulo: "Cancelar contrato",
    descricao:
      "As parcelas em aberto e seus lançamentos no Financeiro são cancelados, e a proteção do aparelho é removida. Parcelas já pagas continuam registradas.",
    botao: "Cancelar contrato",
  },
};

function AcaoContratoDialog({
  acao,
  contratoId,
  temAtraso,
  onClose,
  onFeito,
}: {
  acao: Acao | null;
  contratoId: string | null;
  temAtraso: boolean;
  onClose: () => void;
  onFeito: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [liberarAte, setLiberarAte] = useState(hojeISO());

  useEffect(() => {
    if (acao) {
      setMotivo("");
      setLiberarAte(hojeISO());
    }
  }, [acao]);

  const executar = useMutation({
    mutationFn: async () => {
      const { error } =
        acao === "cancelar"
          ? await supabase.rpc("cancelar_contrato_crediario", {
              p_contrato_id: contratoId!,
              p_motivo: motivo,
            })
          : await supabase.rpc("alterar_bloqueio_crediario", {
              p_contrato_id: contratoId!,
              p_bloquear: acao === "bloquear",
              p_motivo: motivo,
              ...(acao === "liberar" ? { p_liberar_ate: liberarAte } : {}),
            });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        acao === "cancelar"
          ? "Contrato cancelado."
          : acao === "bloquear"
            ? "Bloqueio enviado para o aparelho."
            : "Liberação enviada para o aparelho.",
      );
      onFeito();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const texto = acao ? TEXTO_ACAO[acao] : null;

  return (
    <Dialog open={!!acao} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{texto?.titulo}</DialogTitle>
          <DialogDescription>{texto?.descricao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {acao === "liberar" && temAtraso && (
            <div className="space-y-1.5">
              <Label>Liberado até</Label>
              <Input
                type="date"
                min={hojeISO()}
                value={liberarAte}
                onChange={(e) => setLiberarAte(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant={acao === "liberar" ? "default" : "destructive"}
            onClick={() => executar.mutate()}
            disabled={executar.isPending || motivo.trim().length < 3}
          >
            {executar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {texto?.botao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
