// Shared "PDF pronto" panel for the Aparelhos module — same visible states
// EnviarOsModal.tsx already uses for OS PDFs (spinner while gerando →
// "Visualizar PDF" abre em nova aba, "Compartilhar"/"Baixar", e "Abrir
// WhatsApp" quando não há compartilhamento nativo). Antes disto, os botões
// "Gerar comprovante"/"Termo de garantia" chamavam compartilharOuBaixar()
// direto no clique — sem essa tela, o único feedback era um download
// silencioso (ou nada, quando o navegador bloqueia o clique sintético em
// <a download>), então não havia confirmação visível de que o PDF foi
// gerado.
import { Download, Eye, Loader2, MessageCircle, Share2 } from "lucide-react";
import { buildWaMeLink } from "@/lib/whatsapp";
import { baixarArquivo, podeCompartilharArquivo } from "@/lib/pdf-share";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type PdfGerado = { file: File; url: string };

export function PdfPreviewDialog({
  open,
  onOpenChange,
  titulo,
  gerando,
  pdf,
  telefoneCliente,
  mensagemWhatsapp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  gerando: boolean;
  pdf: PdfGerado | null;
  telefoneCliente?: string | null | undefined;
  mensagemWhatsapp?: string | undefined;
}) {
  const compartilhamentoNativoDisponivel = pdf ? podeCompartilharArquivo(pdf.file) : false;

  function visualizar() {
    if (pdf) window.open(pdf.url, "_blank");
  }

  async function compartilhar() {
    if (!pdf) return;
    if (compartilhamentoNativoDisponivel) {
      try {
        await navigator.share({ title: titulo, files: [pdf.file] });
      } catch (e) {
        if (!(e instanceof DOMException) || e.name !== "AbortError") {
          baixarArquivo(pdf.file);
        }
      }
      return;
    }
    baixarArquivo(pdf.file);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>

        {gerando && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando PDF...
          </div>
        )}

        {pdf && !gerando && (
          <div className="space-y-2">
            <p className="text-center text-xs font-medium text-primary">PDF pronto.</p>

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

            {!compartilhamentoNativoDisponivel && telefoneCliente && (
              <Button
                variant="outline"
                className="h-12 w-full justify-center gap-2"
                onClick={() =>
                  window.open(buildWaMeLink(telefoneCliente, mensagemWhatsapp ?? ""), "_blank")
                }
              >
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
