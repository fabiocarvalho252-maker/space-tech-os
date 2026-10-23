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
import type { AcessoClienteResultado } from "@/lib/cliente-conta/cliente-conta.functions";

export type ClienteAcesso = AcessoClienteResultado & { osNumero?: number | null };

function montarMensagem(a: ClienteAcesso): string {
  const primeiroNome = a.nome.trim().split(/\s+/)[0] || a.nome;
  const os = a.osNumero ? ` a sua Ordem de Serviço nº ${a.osNumero}` : " suas Ordens de Serviço";
  return [
    `Olá ${primeiroNome}! 👋`,
    "",
    `Acompanhe${os} pela nossa Área do Cliente:`,
    a.link,
    "",
    `👤 Usuário: ${a.usuario}`,
    `🔑 Senha: ${a.senha}`,
    "",
    "Guarde esses dados para os próximos acessos.",
  ].join("\n");
}

export function ClienteAcessoModal({
  acesso,
  open,
  onOpenChange,
}: {
  acesso: ClienteAcesso | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const mensagem = acesso ? montarMensagem(acesso) : "";

  const enviarPelaConexao = useMutation({
    mutationFn: () =>
      enviarMensagemWhatsapp({ data: { numero: digitsOnlyBR(acesso!.telefone!), mensagem } }),
    onSuccess: (res) => {
      if (res.status === "falhou") {
        toast.error("Evolution API não confirmou o envio — verifique a conexão em WhatsApp.");
        return;
      }
      toast.success("Acesso enviado pelo WhatsApp da empresa!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copiar(chave: string, texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiado(chave);
    setTimeout(() => setCopiado(null), 2000);
  }

  function enviarWhatsapp() {
    if (!acesso?.telefone) return;
    if (isMobile) {
      window.open(buildWaMeLink(acesso.telefone, mensagem), "_blank");
      return;
    }
    enviarPelaConexao.mutate();
  }

  function linha(chave: string, rotulo: string, valor: string) {
    return (
      <div key={chave} className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-lg border border-input bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {rotulo}
          </p>
          <p className="truncate font-mono text-sm">{valor}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => copiar(chave, valor)}
          title={`Copiar ${rotulo.toLowerCase()}`}
        >
          {copiado === chave ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
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
              ? acesso.redefinida
                ? `${acesso.nome} já tinha acesso — foi gerada uma nova senha. A senha anterior deixou de valer.`
                : `Acesso criado para ${acesso.nome}. Envie os dados abaixo para o cliente acompanhar a OS.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {acesso && (
          <div className="space-y-3">
            {linha("usuario", "Usuário", acesso.usuario)}
            {linha("senha", "Senha", acesso.senha)}
            {linha("link", "Link da Área do Cliente", acesso.link)}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => copiar("mensagem", mensagem)}
            >
              {copiado === "mensagem" ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copiar mensagem completa
            </Button>

            {acesso.telefone ? (
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
                disabled={enviarPelaConexao.isPending}
                onClick={enviarWhatsapp}
              >
                <Send className="h-4 w-4" />
                {enviarPelaConexao.isPending ? "Enviando..." : "Enviar acesso por WhatsApp"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                Cliente sem telefone cadastrado — copie a mensagem acima para compartilhar.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
