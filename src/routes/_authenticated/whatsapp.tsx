import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  MessageSquare,
  QrCode,
  Send,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { digitsOnlyBR, isValidPhoneBR, maskPhoneBR } from "@/lib/whatsapp";
import {
  conectarWhatsapp,
  desconectarWhatsapp,
  enviarMensagemWhatsapp,
  listarMensagensWhatsapp,
  statusWhatsapp,
} from "@/lib/whatsapp/whatsapp.functions";
import type { WhatsappConexao } from "@/lib/whatsapp/types";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp — SpaceTech" },
      { name: "description", content: "Conecte o WhatsApp da empresa via Evolution API." },
    ],
  }),
  component: WhatsappPage,
});

function ehNaoConfigurado(erro: unknown): boolean {
  return erro instanceof Error && /não foi configurada/i.test(erro.message);
}

function qrCodeSrc(qr: string): string {
  return qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
}

function WhatsappPage() {
  const qc = useQueryClient();
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [confirmDesconectar, setConfirmDesconectar] = useState(false);
  const [numero, setNumero] = useState("");
  const [mensagem, setMensagem] = useState("");

  const statusQuery = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => statusWhatsapp(),
    retry: false,
    refetchInterval: (query) => {
      const conexao = query.state.data as WhatsappConexao | null | undefined;
      return conexao?.status === "conectando" ? 4000 : false;
    },
  });

  const naoConfigurado = ehNaoConfigurado(statusQuery.error);
  const conexao = statusQuery.data ?? null;
  const status = conexao?.status ?? "desconectado";

  const mensagensQuery = useQuery({
    queryKey: ["whatsapp-mensagens"],
    queryFn: () => listarMensagensWhatsapp(),
    refetchInterval: status === "conectado" ? 15000 : false,
  });

  useEffect(() => {
    if (status === "conectado" && qrDialogOpen) {
      setQrDialogOpen(false);
      toast.success("WhatsApp conectado!");
      qc.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
    }
  }, [status, qrDialogOpen, qc]);

  const conectar = useMutation({
    mutationFn: () => conectarWhatsapp(),
    onSuccess: (res) => {
      qc.setQueryData(["whatsapp-status"], res);
      setQrDialogOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarWhatsapp(),
    onSuccess: (res) => {
      qc.setQueryData(["whatsapp-status"], res);
      setConfirmDesconectar(false);
      toast.success("WhatsApp desconectado.");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmDesconectar(false);
    },
  });

  const enviar = useMutation({
    mutationFn: () => enviarMensagemWhatsapp({ data: { numero: digitsOnlyBR(numero), mensagem } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
      if (res.status === "falhou") {
        toast.error("Evolution API não confirmou o envio — verifique a conexão.");
      } else {
        toast.success("Mensagem enviada!");
        setMensagem("");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const conectado = status === "conectado";
  const numeroValido = isValidPhoneBR(numero);

  return (
    <div>
      <PageHeader
        title="WhatsApp"
        subtitle="Conexão em tempo real com o WhatsApp da empresa via Evolution API"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Status da conexão</h2>
                <p className="text-sm text-muted-foreground">
                  Instância dedicada desta empresa na Evolution API.
                </p>
              </div>
            </div>

            {naoConfigurado ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Evolution API não configurada no servidor. Preencha <code>EVOLUTION_API_URL</code> e{" "}
                <code>EVOLUTION_API_KEY</code> no <code>.env</code> para habilitar a conexão.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${conectado ? "bg-success animate-pulse" : "bg-destructive"}`}
                    />
                    <span className="font-bold">
                      {status === "conectado" && "🟢 Conectado"}
                      {status === "desconectado" && "🔴 Desconectado"}
                      {status === "conectando" && "🟡 Conectando..."}
                      {status === "erro" && "🔴 Erro na conexão"}
                    </span>
                  </div>
                  {statusQuery.isFetching && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>

                {conectado && conexao?.phone_number && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="h-4 w-4" /> Número conectado:{" "}
                    <strong>{conexao.phone_number}</strong>
                  </div>
                )}
                {status === "erro" && conexao?.last_error && (
                  <p className="mt-3 text-xs text-destructive">{conexao.last_error}</p>
                )}

                <div className="mt-4 flex gap-2">
                  {!conectado ? (
                    <Button
                      className="bg-green-600 hover:bg-green-700 gap-2"
                      disabled={conectar.isPending}
                      onClick={() => conectar.mutate()}
                    >
                      {conectar.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="h-4 w-4" />
                      )}
                      Conectar WhatsApp
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setConfirmDesconectar(true)}>
                      Desconectar
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Enviar mensagem
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Número (com DDD)</Label>
                <Input
                  value={numero}
                  onChange={(e) => setNumero(maskPhoneBR(e.target.value))}
                  placeholder="(00) 00000-0000"
                  disabled={!conectado}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite a mensagem..."
                  disabled={!conectado}
                  className="min-h-[90px]"
                />
              </div>
              <Button
                className="w-full gap-2"
                disabled={!conectado || !numeroValido || !mensagem.trim() || enviar.isPending}
                onClick={() => enviar.mutate()}
              >
                {enviar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar
              </Button>
              {!conectado && (
                <p className="text-xs text-muted-foreground">
                  Conecte o WhatsApp para enviar mensagens.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-7">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Mensagens recentes
            </h3>
            {mensagensQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-secondary/40" />
                ))}
              </div>
            ) : !mensagensQuery.data || mensagensQuery.data.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Nenhuma mensagem ainda"
                description="Mensagens enviadas e recebidas pelo WhatsApp da empresa aparecem aqui."
              />
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {mensagensQuery.data.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 rounded-xl border border-border p-3 bg-muted/20"
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        m.direction === "inbound"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-green-500/10 text-green-600"
                      }`}
                    >
                      {m.direction === "inbound" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">
                          {m.contact_name || maskPhoneBR(m.phone_number)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(m.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground break-words">
                        {m.content || "(sem texto)"}
                      </p>
                      {m.status === "falhou" && (
                        <p className="text-[10px] text-destructive">Falha no envio</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-green-600" /> Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular da empresa → Aparelhos conectados → Conectar um aparelho, e
              escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            {conexao?.qr_code ? (
              <img
                src={qrCodeSrc(conexao.qr_code)}
                alt="QR Code do WhatsApp"
                className="h-56 w-56"
              />
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </>
            )}
            <p className="text-xs text-muted-foreground">Aguardando leitura...</p>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDesconectar}
        onOpenChange={setConfirmDesconectar}
        title="Desconectar WhatsApp?"
        description="A empresa deixará de enviar e receber mensagens até conectar novamente."
        confirmLabel="Desconectar"
        destructive
        loading={desconectar.isPending}
        onConfirm={() => desconectar.mutate()}
      />
    </div>
  );
}
