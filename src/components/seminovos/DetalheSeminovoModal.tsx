// Detalhe do aparelho (pedido, seção 20): dados completos + linha do tempo
// (tabela seminovos_historico, alimentada pelos triggers da migration) +
// ações condicionadas ao status atual, mesma receita de
// DetalheAparelhoModal mas sem garantia/PDF (não pedidos para este módulo).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Eye, EyeOff, Loader2, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { dataBR, statusLabel } from "@/lib/format";
import { mascararCpf } from "@/lib/cpf";
import { base64ParaBytes, sanitizarNomeArquivo } from "@/lib/pdf-share";
import { gerarComprovanteSeminovoCompartilharFn } from "@/lib/seminovos/seminovos.functions";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { SeminovosFotos } from "@/components/SeminovosFotos";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PdfPreviewDialog, type PdfGerado } from "@/components/aparelhos/PdfPreviewDialog";
import { ConsertoCustosSection } from "./ConsertoCustosSection";
import { SubstituirAssinaturaModal } from "./SubstituirAssinaturaModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type SeminovoRow = Database["public"]["Tables"]["seminovos"]["Row"] & {
  cliente?: { nome: string } | null;
};

const TONE_POR_STATUS_SEMINOVO: Record<string, StatusTone> = {
  pendente: "warning",
  disponivel: "success",
  vendido: "info",
  devolvido: "purple",
  sucata: "danger",
  sem_solucao: "neutral",
};

export function DetalheSeminovoModal({
  open,
  onOpenChange,
  seminovo: seminovoProp,
  empresaId,
  podeGerenciarModulo,
  onEditar,
  onVender,
  onDevolver,
  onAvaliarRetorno,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seminovo: SeminovoRow | null;
  empresaId: string;
  podeGerenciarModulo: boolean;
  onEditar: () => void;
  onVender: () => void;
  onDevolver: () => void;
  onAvaliarRetorno: () => void;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [modalAssinatura, setModalAssinatura] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [pdfDialogAberto, setPdfDialogAberto] = useState(false);
  const [pdf, setPdf] = useState<PdfGerado | null>(null);

  // O card de resumo (Compra/Conserto/Custo total/Lucro) precisa refletir
  // mudanças feitas no detalhamento de conserto logo abaixo, na mesma
  // sessão do modal — `seminovoProp` fica congelado no momento em que a
  // linha foi clicada. Refetcha o registro atual, usando o prop só como
  // valor inicial (sem flicker); ConsertoCustosSection invalida esta query
  // toda vez que um item é adicionado/editado/removido.
  const { data: seminovoAtual } = useQuery({
    queryKey: ["seminovo-atual", seminovoProp?.id],
    enabled: open && !!seminovoProp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminovos")
        .select("*, cliente:clientes(nome)")
        .eq("id", seminovoProp!.id)
        .single();
      if (error) throw error;
      return data as SeminovoRow;
    },
    initialData: seminovoProp ?? undefined,
  });
  const seminovo = seminovoAtual ?? seminovoProp;

  const { data: historico = [] } = useQuery({
    queryKey: ["seminovo-historico", seminovo?.id],
    enabled: open && !!seminovo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminovos_historico")
        .select("*")
        .eq("seminovo_id", seminovo!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Espelho no estoque de Aparelhos (criado pelo trigger quando a compra
  // fica "disponivel"). Chave sob ["aparelhos"] para ser recarregada junto
  // com a lista de aparelhos. Sem permissão em Aparelhos a RLS devolve
  // vazio e o bloco simplesmente não aparece.
  const { data: aparelhoVinculado } = useQuery({
    queryKey: ["aparelhos", "por-seminovo", seminovo?.id],
    enabled: open && !!seminovo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelhos")
        .select("id, numero, status")
        .eq("seminovo_id", seminovo!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const remover = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("seminovos").delete().eq("id", seminovo!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      // Seminovos disponíveis espelham em Aparelhos (trigger no banco).
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      setConfirmExcluir(false);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: assinaturaUrl } = useQuery({
    queryKey: ["seminovo-assinatura-url", seminovo?.assinatura_url],
    enabled: open && !!seminovo?.assinatura_url,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("seminovos-fotos")
        .createSignedUrl(seminovo!.assinatura_url!, 3600);
      return data?.signedUrl ?? null;
    },
  });

  const gerarComprovante = useMutation({
    mutationFn: async () => {
      const { base64 } = await gerarComprovanteSeminovoCompartilharFn({
        data: { seminovoId: seminovo!.id },
      });
      const nome = `COMPROVANTE-COMPRA-${sanitizarNomeArquivo(seminovo!.marca + " " + seminovo!.modelo)}.pdf`;
      return new File([base64ParaBytes(base64)], nome, { type: "application/pdf" });
    },
    onSuccess: (file) => setPdf({ file, url: URL.createObjectURL(file) }),
    onError: (e: Error) => toast.error("Erro ao gerar comprovante: " + e.message),
  });

  function abrirComprovante() {
    setPdf(null);
    setPdfDialogAberto(true);
    gerarComprovante.mutate();
  }

  function fecharPdfDialog(v: boolean) {
    if (!v && pdf) URL.revokeObjectURL(pdf.url);
    setPdfDialogAberto(v);
  }

  if (!seminovo) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
              <span>
                {seminovo.marca} {seminovo.modelo}
              </span>
              <StatusBadge
                label={statusLabel(seminovo.status)}
                tone={TONE_POR_STATUS_SEMINOVO[seminovo.status] ?? "neutral"}
              />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {podeGerenciarModulo && (
              <div className="flex flex-wrap gap-2">
                {seminovo.status === "disponivel" && <Button onClick={onVender}>Vender</Button>}
                {seminovo.status === "devolvido" && (
                  <Button onClick={onAvaliarRetorno}>Avaliar retorno</Button>
                )}
                <Button variant="outline" onClick={onEditar}>
                  Editar
                </Button>
                {seminovo.status !== "devolvido" && (
                  <Button variant="outline" onClick={onDevolver}>
                    Devolver
                  </Button>
                )}
                <SeminovosFotos
                  seminovoId={seminovo.id}
                  fotos={seminovo.fotos ?? []}
                  empresaId={empresaId}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={abrirComprovante}
                  disabled={gerarComprovante.isPending}
                >
                  {gerarComprovante.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Gerar comprovante
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmExcluir(true)}
                >
                  Excluir
                </Button>
              </div>
            )}

            <div className="grid gap-4 rounded-xl border border-border bg-secondary/20 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Armazenamento / RAM / Cor</p>
                <p className="font-medium">
                  {[seminovo.armazenamento, seminovo.ram, seminovo.cor]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IMEI</p>
                <p className="font-medium">{seminovo.imei || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <p className="font-medium">{seminovo.estado || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bateria</p>
                <p className="font-medium">
                  {seminovo.bateria_percentual != null ? `${seminovo.bateria_percentual}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data da compra</p>
                <p className="font-medium">{dataBR(seminovo.data_avaliacao)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Acessórios</p>
                <p className="font-medium">{seminovo.acessorios || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Senha / padrão de desbloqueio</p>
                {seminovo.senha_dispositivo || seminovo.padrao_desbloqueio ? (
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {verSenha
                        ? [
                            seminovo.senha_dispositivo && `PIN: ${seminovo.senha_dispositivo}`,
                            seminovo.padrao_desbloqueio &&
                              `Padrão: ${seminovo.padrao_desbloqueio.split("").join("-")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "••••••"}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setVerSenha((v) => !v)}
                      title={verSenha ? "Ocultar" : "Ver senha"}
                    >
                      {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <p className="font-medium">—</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <p className="mb-2 font-semibold text-foreground">👤 Comprado de</p>
              <p>{seminovo.cliente?.nome || seminovo.vendedor_nome || "Particular"}</p>
              {seminovo.vendedor_telefone && (
                <p className="text-muted-foreground">{seminovo.vendedor_telefone}</p>
              )}
              {seminovo.vendedor_documento && (
                <p className="text-muted-foreground">
                  CPF:{" "}
                  {podeGerenciarModulo
                    ? seminovo.vendedor_documento
                    : mascararCpf(seminovo.vendedor_documento)}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">✍️ Assinatura do vendedor</p>
                {podeGerenciarModulo && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5"
                    onClick={() => setModalAssinatura(true)}
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    {seminovo.assinatura_url ? "Substituir" : "Coletar assinatura"}
                  </Button>
                )}
              </div>
              {assinaturaUrl ? (
                <img
                  src={assinaturaUrl}
                  alt="Assinatura do vendedor"
                  className="h-28 rounded-lg border border-border bg-white object-contain"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma assinatura coletada.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Compra</p>
                <p className="font-medium">{brl(seminovo.valor_pago)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conserto</p>
                <p className="font-medium">{brl(seminovo.valor_conserto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo total</p>
                <p className="font-bold">{brl(seminovo.valor_total_gasto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Venda (cliente)</p>
                <p className="font-medium">{brl(seminovo.preco_venda)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Venda (lojista)</p>
                <p className="font-medium">{brl(seminovo.preco_lojista)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lucro previsto</p>
                <p
                  className={`font-bold ${Number(seminovo.lucro_previsto) >= 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {brl(seminovo.lucro_previsto)}
                </p>
              </div>
            </div>

            {aparelhoVinculado && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                <div>
                  <p className="font-semibold text-foreground">
                    No estoque de Aparelhos — AP-{String(aparelhoVinculado.numero).padStart(6, "0")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status lá: {statusLabel(aparelhoVinculado.status)}. Venda, devolução e preço
                    ficam sincronizados entre as duas telas.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link to="/aparelhos" search={{ abrir: aparelhoVinculado.id }}>
                    <ExternalLink className="h-4 w-4" /> Ver no estoque
                  </Link>
                </Button>
              </div>
            )}

            <ConsertoCustosSection
              seminovoId={seminovo.id}
              empresaId={empresaId}
              podeGerenciar={podeGerenciarModulo}
            />

            {seminovo.status === "devolvido" && seminovo.devolucao_motivo && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-sm">
                <p className="mb-1 font-semibold text-foreground">Devolução</p>
                <p className="text-muted-foreground">{dataBR(seminovo.devolucao_data)}</p>
                <p>{seminovo.devolucao_motivo}</p>
              </div>
            )}

            {seminovo.observacoes && (
              <div className="rounded-xl border border-border bg-card p-4 text-sm">
                <p className="mb-1 font-semibold text-foreground">Observações</p>
                <p className="text-muted-foreground">{seminovo.observacoes}</p>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Histórico</p>
              <div className="space-y-3 border-l border-border pl-4">
                {historico.map((h) => (
                  <div key={h.id} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p>{h.descricao}</p>
                  </div>
                ))}
                {!historico.length && (
                  <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmExcluir}
        onOpenChange={setConfirmExcluir}
        title="Excluir este registro?"
        description="Esta ação remove o registro de compra permanentemente e não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => remover.mutate()}
      />

      <SubstituirAssinaturaModal
        open={modalAssinatura}
        onOpenChange={setModalAssinatura}
        seminovoId={seminovo.id}
        empresaId={empresaId}
        jaTemAssinatura={!!seminovo.assinatura_url}
      />

      <PdfPreviewDialog
        open={pdfDialogAberto}
        onOpenChange={fecharPdfDialog}
        titulo="Comprovante de compra"
        gerando={gerarComprovante.isPending}
        pdf={pdf}
        telefoneCliente={seminovo.vendedor_telefone}
        mensagemWhatsapp={`Olá! Segue o comprovante de compra do ${seminovo.marca} ${seminovo.modelo} da SPACE TECH.`}
      />
    </>
  );
}
