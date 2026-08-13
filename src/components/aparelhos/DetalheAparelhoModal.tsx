// Detail view (pedido, seção 20): dados completos + histórico + ações
// condicionadas ao status atual — "Vender" nunca aparece para um aparelho
// já vendido, etc. Ações de transição (reservar/cancelar reserva/devolver/
// cancelar venda) chamam as funções RPC da migration; edição de campos
// simples (status "cancelado" a partir de disponível, emissão de garantia
// avulsa) é feita com update/insert direto, protegido pela mesma RLS
// 'aparelhos'/'gerenciar' de todo o resto do módulo.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { base64ParaBytes, sanitizarNomeArquivo } from "@/lib/pdf-share";
import {
  gerarComprovanteAparelhoCompartilharFn,
  gerarTermoGarantiaAparelhoCompartilharFn,
} from "@/lib/aparelhos/aparelhos.functions";
import { PdfPreviewDialog, type PdfGerado } from "./PdfPreviewDialog";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AparelhoFotos } from "@/components/AparelhoFotos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const TONE_POR_STATUS: Record<string, StatusTone> = {
  disponivel: "success",
  reservado: "warning",
  vendido: "info",
  devolvido: "danger",
  garantia: "purple",
  cancelado: "neutral",
};

export function DetalheAparelhoModal({
  open,
  onOpenChange,
  aparelho: aparelhoProp,
  empresaId,
  podeVerCusto,
  podeGerenciarModulo,
  onEditar,
  onVender,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aparelho: AparelhoRow | null;
  empresaId: string;
  podeVerCusto: boolean;
  podeGerenciarModulo: boolean;
  onEditar: () => void;
  onVender: () => void;
}) {
  const qc = useQueryClient();
  const [confirmAcao, setConfirmAcao] = useState<
    null | "cancelar" | "cancelar_reserva" | "devolver" | "cancelar_venda"
  >(null);
  const [motivo, setMotivo] = useState("");
  const [condicao, setCondicao] = useState("");
  const [emitirGarantiaAberto, setEmitirGarantiaAberto] = useState(false);
  const [reservarAberto, setReservarAberto] = useState(false);
  const [reservarClienteId, setReservarClienteId] = useState("");
  const [reservarExpiraEm, setReservarExpiraEm] = useState("");
  const [reservarObs, setReservarObs] = useState("");
  const [pdfDialogAberto, setPdfDialogAberto] = useState(false);
  const [pdfTitulo, setPdfTitulo] = useState("");
  const [pdf, setPdf] = useState<PdfGerado | null>(null);
  const [termoId, setTermoId] = useState("");
  const [diasGarantia, setDiasGarantia] = useState("90");

  // A lista (aparelhos.tsx) só recarrega quando ["aparelhos"] é invalidado,
  // mas o objeto `aparelhoProp` passado a este modal fica congelado no
  // momento em que a linha foi clicada — sem isso, depois de reservar/
  // vender/devolver etc. *a partir deste próprio modal*, os botões e o
  // badge de status continuariam mostrando o estado antigo até fechar e
  // reabrir. Busca o registro atual, usando a prop só como valor inicial
  // (sem flicker) e refetchando toda vez que `invalidarTudo()` roda.
  const { data: aparelhoAtual } = useQuery({
    queryKey: ["aparelho-atual", aparelhoProp?.id],
    enabled: open && !!aparelhoProp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelhos")
        .select("*")
        .eq("id", aparelhoProp!.id)
        .single();
      if (error) throw error;
      return data;
    },
    initialData: aparelhoProp ?? undefined,
  });
  const aparelho = aparelhoAtual ?? aparelhoProp;

  const { data: historico = [] } = useQuery({
    queryKey: ["aparelho-historico", aparelho?.id],
    enabled: open && !!aparelho,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelho_historico")
        .select("*")
        .eq("aparelho_id", aparelho!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: venda } = useQuery({
    queryKey: ["aparelho-venda", aparelho?.id],
    enabled: open && !!aparelho && aparelho.status === "vendido",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venda_itens")
        .select(
          "venda_id, vendas(numero, total, forma_pagamento, created_at, cliente:clientes(nome, telefone))",
        )
        .eq("aparelho_id", aparelho!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        venda_id: string;
        vendas: {
          numero: number;
          total: number;
          forma_pagamento: string;
          created_at: string;
          cliente: { nome: string | null; telefone: string | null } | null;
        } | null;
      } | null;
    },
  });

  const { data: garantia } = useQuery({
    queryKey: ["aparelho-garantia", aparelho?.id],
    enabled: open && !!aparelho && aparelho.status === "vendido",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelho_garantias")
        .select("*")
        .eq("aparelho_id", aparelho!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: termos = [] } = useQuery({
    queryKey: ["termos-garantia-aparelhos"],
    enabled: emitirGarantiaAberto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termos_garantia")
        .select("id, titulo")
        .eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientesParaReserva = [] } = useQuery({
    queryKey: ["clientes-aparelhos"],
    enabled: reservarAberto,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  function invalidarTudo() {
    qc.invalidateQueries({ queryKey: ["aparelhos"] });
    qc.invalidateQueries({ queryKey: ["aparelho-atual", aparelho?.id] });
    qc.invalidateQueries({ queryKey: ["aparelho-historico", aparelho?.id] });
    qc.invalidateQueries({ queryKey: ["aparelho-garantia", aparelho?.id] });
    qc.invalidateQueries({ queryKey: ["aparelho-venda", aparelho?.id] });
  }

  const reservar = useMutation({
    mutationFn: async () => {
      if (!reservarClienteId) throw new Error("Selecione o cliente.");
      const { error } = await supabase.rpc("reservar_aparelho", {
        p_aparelho_id: aparelho!.id,
        p_cliente_id: reservarClienteId,
        ...(reservarExpiraEm ? { p_expira_em: new Date(reservarExpiraEm).toISOString() } : {}),
        ...(reservarObs.trim() ? { p_observacao: reservarObs.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aparelho reservado");
      invalidarTudo();
      setReservarAberto(false);
      setReservarClienteId("");
      setReservarExpiraEm("");
      setReservarObs("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarReserva = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("cancelar_reserva_aparelho", {
        p_aparelho_id: aparelho!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva liberada");
      invalidarTudo();
      setConfirmAcao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const devolver = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) throw new Error("Informe o motivo da devolução.");
      const { error } = await supabase.rpc("devolver_aparelho", {
        p_aparelho_id: aparelho!.id,
        p_motivo: motivo.trim(),
        ...(condicao.trim() ? { p_condicao: condicao.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aparelho devolvido");
      invalidarTudo();
      setConfirmAcao(null);
      setMotivo("");
      setCondicao("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarVenda = useMutation({
    mutationFn: async () => {
      if (!venda?.venda_id) throw new Error("Venda não encontrada.");
      const { error } = await supabase.rpc("cancelar_venda_aparelho", {
        p_venda_id: venda.venda_id,
        ...(motivo.trim() ? { p_motivo: motivo.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Venda cancelada");
      invalidarTudo();
      setConfirmAcao(null);
      setMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelarCadastro = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("aparelhos")
        .update({ status: "cancelado" })
        .eq("id", aparelho!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aparelho cancelado");
      invalidarTudo();
      setConfirmAcao(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emitirGarantia = useMutation({
    mutationFn: async () => {
      const dias = Number(diasGarantia) || 0;
      if (dias <= 0) throw new Error("Informe os dias de garantia.");
      if (!venda?.venda_id) throw new Error("Venda não encontrada.");
      const inicio = new Date();
      const fim = new Date(inicio);
      fim.setDate(fim.getDate() + dias);
      const { error } = await supabase.from("aparelho_garantias").insert({
        user_id: empresaId,
        aparelho_id: aparelho!.id,
        cliente_id: null,
        venda_id: venda.venda_id,
        termo_id: termoId || null,
        dias,
        inicio: inicio.toISOString().slice(0, 10),
        fim: fim.toISOString().slice(0, 10),
      });
      if (error) throw error;
      await supabase.from("aparelho_historico").insert({
        user_id: empresaId,
        aparelho_id: aparelho!.id,
        evento: "garantia",
        descricao: `Garantia emitida — ${dias} dias`,
      });
    },
    onSuccess: () => {
      toast.success("Garantia emitida");
      invalidarTudo();
      setEmitirGarantiaAberto(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gerarComprovante = useMutation({
    mutationFn: async () => {
      if (!venda?.venda_id) throw new Error("Venda não encontrada.");
      const { base64 } = await gerarComprovanteAparelhoCompartilharFn({
        data: { vendaId: venda.venda_id },
      });
      const nome = `COMPROVANTE-${sanitizarNomeArquivo(aparelho!.marca + " " + aparelho!.modelo)}.pdf`;
      return new File([base64ParaBytes(base64)], nome, { type: "application/pdf" });
    },
    onSuccess: (file) => setPdf({ file, url: URL.createObjectURL(file) }),
    onError: (e: Error) => toast.error("Erro ao gerar comprovante: " + e.message),
  });

  const gerarTermo = useMutation({
    mutationFn: async () => {
      if (!garantia?.id) throw new Error("Este aparelho não tem garantia emitida.");
      const { base64 } = await gerarTermoGarantiaAparelhoCompartilharFn({
        data: { garantiaId: garantia.id },
      });
      const nome = `TERMO-GARANTIA-${sanitizarNomeArquivo(aparelho!.marca + " " + aparelho!.modelo)}.pdf`;
      return new File([base64ParaBytes(base64)], nome, { type: "application/pdf" });
    },
    onSuccess: (file) => setPdf({ file, url: URL.createObjectURL(file) }),
    onError: (e: Error) => toast.error("Erro ao gerar termo: " + e.message),
  });

  function abrirComprovante() {
    setPdfTitulo("Comprovante de venda");
    setPdf(null);
    setPdfDialogAberto(true);
    gerarComprovante.mutate();
  }

  function abrirTermo() {
    setPdfTitulo("Termo de garantia");
    setPdf(null);
    setPdfDialogAberto(true);
    gerarTermo.mutate();
  }

  function fecharPdfDialog(open: boolean) {
    if (!open && pdf) URL.revokeObjectURL(pdf.url);
    setPdfDialogAberto(open);
  }

  if (!aparelho) return null;
  const lucro = Number(aparelho.preco_venda) - Number(aparelho.preco_custo);
  const cliente = venda?.vendas?.cliente ?? undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span>
                {aparelho.marca} {aparelho.modelo}
              </span>
              <StatusBadge
                label={statusLabel(aparelho.status)}
                tone={TONE_POR_STATUS[aparelho.status] ?? "neutral"}
              />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {aparelho.status === "disponivel" && podeGerenciarModulo && (
                <>
                  <Button onClick={onVender}>Vender</Button>
                  <Button variant="outline" onClick={() => setReservarAberto(true)}>
                    Reservar
                  </Button>
                  <Button variant="outline" onClick={onEditar}>
                    Editar
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmAcao("cancelar")}>
                    Cancelar
                  </Button>
                </>
              )}
              {aparelho.status === "reservado" && podeGerenciarModulo && (
                <>
                  <Button onClick={onVender}>Vender</Button>
                  <Button variant="outline" onClick={() => setConfirmAcao("cancelar_reserva")}>
                    Liberar reserva
                  </Button>
                  <Button variant="outline" onClick={onEditar}>
                    Editar
                  </Button>
                </>
              )}
              {aparelho.status === "vendido" && (
                <>
                  <Button
                    variant="outline"
                    onClick={abrirComprovante}
                    disabled={gerarComprovante.isPending}
                    className="gap-2"
                  >
                    {gerarComprovante.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Gerar comprovante
                  </Button>
                  {garantia ? (
                    <Button
                      variant="outline"
                      onClick={abrirTermo}
                      disabled={gerarTermo.isPending}
                      className="gap-2"
                    >
                      {gerarTermo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <ShieldCheck className="h-4 w-4" /> Termo de garantia
                    </Button>
                  ) : podeGerenciarModulo ? (
                    <Button
                      variant="outline"
                      onClick={() => setEmitirGarantiaAberto(true)}
                      className="gap-2"
                    >
                      <ShieldCheck className="h-4 w-4" /> Emitir garantia
                    </Button>
                  ) : null}
                  {cliente?.telefone && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        window.open(
                          `https://wa.me/55${cliente.telefone!.replace(/\D/g, "")}`,
                          "_blank",
                        )
                      }
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp do cliente
                    </Button>
                  )}
                  {podeGerenciarModulo && (
                    <>
                      <Button variant="outline" onClick={() => setConfirmAcao("devolver")}>
                        Devolver
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmAcao("cancelar_venda")}>
                        Cancelar venda
                      </Button>
                    </>
                  )}
                </>
              )}
              {(aparelho.status === "devolvido" || aparelho.status === "cancelado") &&
                podeGerenciarModulo && (
                  <Button variant="outline" onClick={onEditar}>
                    Editar
                  </Button>
                )}
              <AparelhoFotos aparelhoId={aparelho.id} empresaId={empresaId} />
            </div>

            <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">
                  {aparelho.tipo === "lacrado" ? "Lacrado" : "Seminovo"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nº</p>
                <p className="font-medium">AP-{String(aparelho.numero).padStart(6, "0")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Armazenamento / RAM / Cor</p>
                <p className="font-medium">
                  {[aparelho.armazenamento, aparelho.ram, aparelho.cor]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IMEI</p>
                <p className="font-medium">{aparelho.imei1 ?? "—"}</p>
              </div>
              {aparelho.numero_serie && (
                <div>
                  <p className="text-xs text-muted-foreground">Número de série</p>
                  <p className="font-medium">{aparelho.numero_serie}</p>
                </div>
              )}
              {aparelho.tipo === "seminovo" && aparelho.estado_conservacao && (
                <div>
                  <p className="text-xs text-muted-foreground">Condição</p>
                  <p className="font-medium">{aparelho.estado_conservacao}</p>
                </div>
              )}
              {aparelho.saude_bateria != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Saúde da bateria</p>
                  <p className="font-medium">{aparelho.saude_bateria}%</p>
                </div>
              )}
            </div>

            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
              {podeVerCusto && (
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="font-medium">{brl(aparelho.preco_custo)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Venda</p>
                <p className="font-medium">{brl(aparelho.preco_venda)}</p>
              </div>
              {podeVerCusto && (
                <div>
                  <p className="text-xs text-muted-foreground">Lucro</p>
                  <p
                    className={`font-bold ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}
                  >
                    {brl(lucro)}
                  </p>
                </div>
              )}
            </div>

            {venda?.vendas && (
              <div className="rounded-xl border border-border bg-card p-4 text-sm">
                <p className="mb-2 font-semibold text-foreground">Venda</p>
                <p>Nº #{String(venda.vendas.numero).padStart(4, "0")}</p>
                <p>Cliente: {cliente?.nome ?? "—"}</p>
                <p>Data: {dataBR(venda.vendas.created_at)}</p>
                <p>Pagamento: {venda.vendas.forma_pagamento}</p>
                {garantia && (
                  <p>
                    Garantia: {garantia.dias} dias ({dataBR(garantia.inicio)} —{" "}
                    {dataBR(garantia.fim)})
                  </p>
                )}
              </div>
            )}

            {aparelho.status === "reservado" && aparelho.reservado_ate && (
              <p className="text-xs text-muted-foreground">
                Reservado até {dataBR(aparelho.reservado_ate)}
                {aparelho.reservado_observacao ? ` — ${aparelho.reservado_observacao}` : ""}
              </p>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Histórico</p>
              <div className="space-y-3 border-l border-border pl-4">
                {historico.map((h) => (
                  <div key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">{dataBR(h.created_at)}</p>
                    <p>{h.descricao}</p>
                  </div>
                ))}
                {!historico.length && <p className="text-sm text-muted-foreground">Sem eventos.</p>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog
        open={pdfDialogAberto}
        onOpenChange={fecharPdfDialog}
        titulo={pdfTitulo}
        gerando={gerarComprovante.isPending || gerarTermo.isPending}
        pdf={pdf}
        telefoneCliente={cliente?.telefone}
        mensagemWhatsapp={`Olá${cliente?.nome ? `, ${cliente.nome}` : ""}! Segue o ${pdfTitulo.toLowerCase()} da SPACE TECH.`}
      />

      <Dialog open={emitirGarantiaAberto} onOpenChange={setEmitirGarantiaAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Emitir garantia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Modelo de garantia</Label>
              <Select value={termoId} onValueChange={setTermoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem termo" />
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
                min={1}
                value={diasGarantia}
                onChange={(e) => setDiasGarantia(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEmitirGarantiaAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => emitirGarantia.mutate()} disabled={emitirGarantia.isPending}>
              {emitirGarantia.isPending ? "Emitindo..." : "Emitir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reservarAberto} onOpenChange={setReservarAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reservar aparelho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={reservarClienteId} onValueChange={setReservarClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientesParaReserva.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de expiração</Label>
              <Input
                type="date"
                value={reservarExpiraEm}
                onChange={(e) => setReservarExpiraEm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea
                value={reservarObs}
                onChange={(e) => setReservarObs(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setReservarAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => reservar.mutate()}
              disabled={reservar.isPending || !reservarClienteId}
            >
              {reservar.isPending ? "Reservando..." : "Reservar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmAcao === "cancelar"}
        onOpenChange={(v) => !v && setConfirmAcao(null)}
        title="Cancelar este aparelho?"
        description="O cadastro fica marcado como cancelado e sai da lista de disponíveis."
        confirmLabel="Cancelar aparelho"
        destructive
        loading={cancelarCadastro.isPending}
        onConfirm={() => cancelarCadastro.mutate()}
      />

      <ConfirmDialog
        open={confirmAcao === "cancelar_reserva"}
        onOpenChange={(v) => !v && setConfirmAcao(null)}
        title="Liberar esta reserva?"
        description="O aparelho volta a ficar disponível para venda a qualquer cliente."
        confirmLabel="Liberar"
        loading={cancelarReserva.isPending}
        onConfirm={() => cancelarReserva.mutate()}
      />

      <Dialog open={confirmAcao === "devolver"} onOpenChange={(v) => !v && setConfirmAcao(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver aparelho</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Condição do aparelho</Label>
              <Input value={condicao} onChange={(e) => setCondicao(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmAcao(null)}>
              Cancelar
            </Button>
            <Button onClick={() => devolver.mutate()} disabled={devolver.isPending}>
              {devolver.isPending ? "Devolvendo..." : "Confirmar devolução"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmAcao === "cancelar_venda"}
        onOpenChange={(v) => !v && setConfirmAcao(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar esta venda?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O aparelho volta para o estoque como cancelado e o lançamento financeiro é cancelado.
              A venda em si não é apagada.
            </p>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmAcao(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelarVenda.mutate()}
              disabled={cancelarVenda.isPending}
            >
              {cancelarVenda.isPending ? "Cancelando..." : "Cancelar venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
