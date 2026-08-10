import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, statusLabel } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { enviarMensagemWhatsapp } from "@/lib/whatsapp/whatsapp.functions";
import {
  buildMensagensRapidas,
  buildWaMeLink,
  digitsOnlyBR,
  isValidPhoneBR,
  maskPhoneBR,
  possuiVariaveisNaoPreenchidas,
  preencherVariaveisWhatsApp,
} from "@/lib/whatsapp";

// Any OS row shape from the ordens.tsx list/edit form is enough here — this
// modal only ever reads the fields below.
export type WhatsAppOsAlvo = {
  numero: number;
  aparelho?: string | null;
  status: string;
  valor: number;
  responsavel?: string | null;
  clientes?: { nome?: string | null; telefone?: string | null } | null;
};

export function WhatsAppSendModal({
  os,
  open,
  onOpenChange,
}: {
  os: WhatsAppOsAlvo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: whatsappConfig } = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in the generated Database type yet, see src/lib/whatsapp/types.ts header
        .from("whatsapp_config" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as Record<string, unknown> | null;
    },
    enabled: open,
  });

  const mensagens = useMemo(() => buildMensagensRapidas(whatsappConfig), [whatsappConfig]);
  const [mensagemId, setMensagemId] = useState(mensagens[0]?.id ?? "padrao");
  const [texto, setTexto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [textoEditadoManualmente, setTextoEditadoManualmente] = useState(false);

  const variaveis = useMemo(
    () => ({
      cliente: os?.clientes?.nome ?? "",
      os: os ? String(os.numero) : "",
      numero: os ? String(os.numero) : "",
      valor: os ? brl(os.valor) : "",
      status: os ? statusLabel(os.status) : "",
      tecnico: os?.responsavel ?? "",
    }),
    [os],
  );

  // Reset to the first template + the client's own phone every time the
  // modal is opened for a (possibly different) OS.
  useEffect(() => {
    if (!open || !os) return;
    const primeira = mensagens[0];
    setMensagemId(primeira?.id ?? "padrao");
    setTexto(primeira ? preencherVariaveisWhatsApp(primeira.texto, variaveis) : "");
    setTelefone(maskPhoneBR(os.clientes?.telefone ?? ""));
    setTextoEditadoManualmente(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, os?.numero]);

  function selecionarMensagem(id: string) {
    setMensagemId(id);
    const msg = mensagens.find((m) => m.id === id);
    setTexto(msg ? preencherVariaveisWhatsApp(msg.texto, variaveis) : "");
    setTextoEditadoManualmente(false);
  }

  const telefoneValido = isValidPhoneBR(telefone);
  const faltamVariaveis = possuiVariaveisNaoPreenchidas(texto);
  const isMobile = useIsMobile();

  const enviarPelaConexao = useMutation({
    mutationFn: () =>
      enviarMensagemWhatsapp({ data: { numero: digitsOnlyBR(telefone), mensagem: texto } }),
    onSuccess: (res) => {
      if (res.status === "falhou") {
        toast.error("Evolution API não confirmou o envio — verifique a conexão em WhatsApp.");
        return;
      }
      toast.success("Mensagem enviada pelo WhatsApp da empresa!");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function enviar() {
    if (!telefoneValido) {
      toast.error("Informe um telefone válido com DDD para enviar.");
      return;
    }
    if (!texto.trim()) {
      toast.error("A mensagem não pode ficar vazia.");
      return;
    }
    // No celular, deixa a pessoa mandar pelo próprio app do WhatsApp — mais
    // natural do que depender da conexão da empresa. No desktop, onde não
    // tem WhatsApp instalado, usa a conexão real (Evolution API).
    if (isMobile) {
      window.open(buildWaMeLink(telefone, texto), "_blank");
      onOpenChange(false);
      return;
    }
    enviarPelaConexao.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            {os ? `OS ${os.numero} — ${os.clientes?.nome ?? "cliente sem nome"}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(maskPhoneBR(e.target.value))}
              placeholder="(00) 00000-0000"
            />
            {!telefoneValido && telefone.length > 0 && (
              <p className="text-xs text-destructive">Telefone incompleto — inclua o DDD.</p>
            )}
            {digitsOnlyBR(telefone).length === 0 && (
              <p className="text-xs text-muted-foreground">Cliente sem telefone cadastrado.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Mensagem rápida</Label>
            <div className="flex flex-wrap gap-1.5">
              {mensagens.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selecionarMensagem(m.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    mensagemId === m.id && !textoEditadoManualmente
                      ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Texto</Label>
            <Textarea
              className="min-h-[110px] text-sm"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setTextoEditadoManualmente(true);
              }}
            />
            {faltamVariaveis && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" /> A mensagem ainda tem variáveis sem
                preencher ({"{cliente}"}, {"{os}"} etc.).
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="gap-2 bg-green-600 hover:bg-green-700"
            disabled={!telefoneValido || !texto.trim() || enviarPelaConexao.isPending}
            onClick={enviar}
          >
            {enviarPelaConexao.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}{" "}
            Enviar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
