import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildWaMeLink, digitsOnlyBR } from "@/lib/whatsapp";
import { enviarMensagemWhatsapp } from "@/lib/whatsapp/whatsapp.functions";

export type ClienteAcesso = { link: string; nome: string; telefone: string | null };

export function ClienteAcessoModal({
  acesso,
  open,
  onOpenChange,
}: {
  acesso: ClienteAcesso | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const isMobile = useIsMobile();

  const mensagem = acesso
    ? `Olá ${acesso.nome}! Acompanhe sua Ordem de Serviço na sua Área do Cliente: ${acesso.link}`
    : "";

  const enviarPelaConexao = useMutation({
    mutationFn: () =>
      enviarMensagemWhatsapp({ data: { numero: digitsOnlyBR(acesso!.telefone!), mensagem } }),
    onSuccess: (res) => {
      if (res.status === "falhou") {
        toast.error("Evolution API não confirmou o envio — verifique a conexão em WhatsApp.");
        return;
      }
      toast.success("Link enviado pelo WhatsApp da empresa!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copiar() {
    if (!acesso) return;
    navigator.clipboard.writeText(acesso.link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function enviarWhatsapp() {
    if (!acesso?.telefone) return;
    if (isMobile) {
      window.open(buildWaMeLink(acesso.telefone, mensagem), "_blank");
      return;
    }
    enviarPelaConexao.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Acesso à Área do Cliente
          </DialogTitle>
          <DialogDescription>
            {acesso
              ? `Link de login imediato para ${acesso.nome} acompanhar esta OS — funciona uma única vez e expira em algumas horas.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {acesso && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={acesso.link}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 flex-1 truncate rounded-lg border border-input bg-muted/30 px-3 text-xs text-muted-foreground"
              />
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={copiar}>
                {copiado ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {acesso.telefone ? (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                disabled={enviarPelaConexao.isPending}
                onClick={enviarWhatsapp}
              >
                <Send className="h-4 w-4" /> Enviar por WhatsApp
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cliente sem telefone cadastrado — copie o link acima para compartilhar.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
