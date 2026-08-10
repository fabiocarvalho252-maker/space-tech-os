import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { solicitarQrCodeWhatsApp } from "@/lib/whatsapp";

// No WhatsApp session/QR provider (Evolution API, Baileys, WPPConnect, Z-API,
// Twilio etc.) is wired up yet — solicitarQrCodeWhatsApp() always rejects, so
// this always lands on the "não configurado" state below instead of faking a
// QR code. Swap that function's body for a real call once a provider is
// chosen; this modal won't need to change.
export function WhatsAppConnectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [estado, setEstado] = useState<"carregando" | "erro" | "pronto">("carregando");
  const [erro, setErro] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEstado("carregando");
    setErro("");
    setQr(null);
    solicitarQrCodeWhatsApp()
      .then((res) => {
        setQr(res.qr);
        setEstado("pronto");
      })
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : "Não foi possível gerar o QR Code.");
        setEstado("erro");
      });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-green-600" /> Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code pelo WhatsApp do número da empresa para vincular uma nova instância.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
          {estado === "carregando" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
            </>
          )}
          {estado === "erro" && (
            <>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm font-medium">Conexão ainda não disponível</p>
              <p className="text-xs text-muted-foreground">{erro}</p>
            </>
          )}
          {estado === "pronto" && qr && (
            <img src={qr} alt="QR Code do WhatsApp" className="h-48 w-48" />
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
