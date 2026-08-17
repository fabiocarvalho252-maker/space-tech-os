// Mobile-first "Enviar OS" flow: generates the OS PDF (server-side, same
// renderer as os-pdf.server.ts's WhatsApp attachments) and hands it to the
// device's native share sheet via navigator.share({ files }) — so the user
// picks WhatsApp/e-mail/Drive/etc. themselves instead of the app trying to
// guess a delivery channel. wa.me alone can't attach a local file to a
// WhatsApp message, so it only shows up here as a text-only fallback when
// file sharing isn't supported by the browser.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildWaMeLink } from "@/lib/whatsapp";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { useCurrentUser, useProfile } from "@/hooks/useCurrentUser";
import { gerarPdfOsCompartilharFn } from "@/lib/os-pdf-share.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type EnviarOsAlvo = {
  id: string;
  user_id: string;
  numero: number;
  aparelho?: string | null;
  valor: number;
  clientes?: { nome?: string | null; telefone?: string | null } | null;
};

// Built from char codes (not a literal combining-marks range in source) so
// the U+0300..U+036F block survives copy/paste and editor round-trips
// intact — after NFD normalization, "João" becomes "Joa" + U+0303 (combining
// tilde), and this strips that combining mark before the alnum filter below.
const DIACRITICOS = new RegExp(
  `[\\u${(0x0300).toString(16).padStart(4, "0")}-\\u${(0x036f).toString(16).padStart(4, "0")}]`,
  "g",
);

function sanitizarNomeArquivo(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(DIACRITICOS, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase() || "CLIENTE"
  );
}

function base64ParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function podeCompartilharArquivo(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

export function EnviarOsModal({
  os,
  open,
  onOpenChange,
}: {
  os: EnviarOsAlvo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: profile } = useProfile();
  const [pdf, setPdf] = useState<{ file: File; url: string } | null>(null);

  const gerar = useMutation({
    mutationFn: async () => {
      if (!os) throw new Error("OS não selecionada.");
      const { base64 } = await gerarPdfOsCompartilharFn({ data: { osId: os.id, modo: "os" } });
      const nomeArquivo = `SPACE-TECH-OS-${String(os.numero).padStart(6, "0")}-${sanitizarNomeArquivo(os.clientes?.nome || "cliente")}.pdf`;
      return new File([base64ParaBytes(base64)], nomeArquivo, { type: "application/pdf" });
    },
    onSuccess: (file) => setPdf({ file, url: URL.createObjectURL(file) }),
    onError: (e: Error) => toast.error("Erro ao gerar PDF da OS: " + e.message),
  });

  useEffect(() => {
    if (open && os) {
      gerar.mutate();
    } else {
      setPdf((atual) => {
        if (atual) URL.revokeObjectURL(atual.url);
        return null;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, os?.id]);

  async function registrarEnvio(canal: string) {
    if (!os) return;
    const perfil = profile as { nome?: string; loja?: string } | null | undefined;
    const nomeUsuario = perfil?.nome || perfil?.loja || user?.email || "Usuário";
    await supabase.from("os_historico" as any).insert({
      user_id: os.user_id,
      os_id: os.id,
      evento: "envio",
      descricao: `Compartilhamento iniciado por ${nomeUsuario} — ${canal}.`,
      created_by: user?.id ?? null,
    });
    qc.invalidateQueries({ queryKey: ["os-historico", os.id] });
  }

  async function compartilhar() {
    if (!pdf || !os) return;
    if (podeCompartilharArquivo(pdf.file)) {
      try {
        await navigator.share({
          title: `Ordem de Serviço ${os.numero}`,
          text: `Segue a Ordem de Serviço nº ${os.numero} da SPACE TECH.`,
          files: [pdf.file],
        });
        await registrarEnvio("compartilhamento nativo");
        onOpenChange(false);
      } catch (e) {
        if (!(e instanceof DOMException) || e.name !== "AbortError") {
          toast.error("Não foi possível compartilhar o PDF.");
        }
      }
      return;
    }
    baixar();
  }

  function visualizar() {
    if (pdf) window.open(pdf.url, "_blank");
  }

  function baixar() {
    if (!pdf) return;
    const a = document.createElement("a");
    a.href = pdf.url;
    a.download = pdf.file.name;
    a.click();
    registrarEnvio("download manual");
  }

  function abrirWhatsApp() {
    const telefone = os?.clientes?.telefone;
    if (!os || !telefone) return;
    const mensagem = `Olá, ${os.clientes?.nome ?? ""}!\n\nSegue a Ordem de Serviço nº ${os.numero} da SPACE TECH.\n\nO documento contém os detalhes do serviço realizado, valores e condições de garantia.\n\nSPACE TECH`;
    window.open(buildWaMeLink(telefone, mensagem), "_blank");
    registrarEnvio("WhatsApp (mensagem, anexar PDF manualmente)");
  }

  const compartilhamentoNativoDisponivel = pdf ? podeCompartilharArquivo(pdf.file) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Enviar Ordem de Serviço</DialogTitle>
          <DialogDescription>{os ? `OS Nº ${os.numero}` : ""}</DialogDescription>
        </DialogHeader>

        {os && (
          <div className="space-y-1 rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Cliente: </span>
              <span className="font-medium">{os.clientes?.nome || "Sem cliente vinculado"}</span>
            </p>
            {os.aparelho && (
              <p>
                <span className="text-muted-foreground">Aparelho: </span>
                <span className="font-medium">{os.aparelho}</span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Valor: </span>
              <span className="font-medium">{brl(os.valor)}</span>
            </p>
          </div>
        )}

        {gerar.isPending && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF da OS...
          </div>
        )}

        {pdf && !gerar.isPending && (
          <div className="space-y-2">
            <p className="text-center text-xs font-medium text-primary">PDF pronto para envio.</p>

            <Button
              variant="outline"
              className="h-12 w-full justify-center gap-2"
              onClick={visualizar}
            >
              <Eye className="h-4 w-4" /> Visualizar PDF
            </Button>

            <Button className="h-12 w-full justify-center gap-2" onClick={compartilhar}>
              {compartilhamentoNativoDisponivel ? (
                <>
                  <Share2 className="h-4 w-4" /> Compartilhar PDF
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Baixar PDF
                </>
              )}
            </Button>

            {!compartilhamentoNativoDisponivel && os?.clientes?.telefone && (
              <Button
                variant="outline"
                className="h-12 w-full justify-center gap-2"
                onClick={abrirWhatsApp}
              >
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
              </Button>
            )}
          </div>
        )}

        <Button variant="ghost" className="h-10 w-full" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
