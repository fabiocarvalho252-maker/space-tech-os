import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Loader2, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import {
  gerarPixRenovacaoFn,
  statusPixRenovacaoFn,
} from "@/lib/mercadopago/subscription.functions";
import { linhasComprovante, type DadosComprovante } from "@/lib/planos/comprovante";

type Ciclo = "monthly" | "yearly";

// Meu Plano > Pagar com Pix: gera o Pix no Mercado Pago, mostra o QR e o
// copia e cola e fica consultando até confirmar. Confirmado, o acesso já foi
// renovado no servidor e o comprovante aparece aqui (e vai pelo WhatsApp).
export function PixRenovacaoDialog({
  ciclo,
  onClose,
}: {
  ciclo: Ciclo | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const gerar = useMutation({
    mutationFn: (c: Ciclo) => gerarPixRenovacaoFn({ data: { ciclo: c } }),
    onError: (e: Error) => toast.error(e.message),
  });
  const { mutate, reset } = gerar;

  useEffect(() => {
    if (ciclo) mutate(ciclo);
    else reset();
  }, [ciclo, mutate, reset]);

  const pix = gerar.data;
  const [expirado, setExpirado] = useState(false);
  useEffect(() => {
    setExpirado(false);
    if (!pix) return;
    const falta = new Date(pix.expiraEm).getTime() - Date.now();
    const t = setTimeout(() => setExpirado(true), Math.max(0, falta));
    return () => clearTimeout(t);
  }, [pix]);

  const { data: situacao } = useQuery({
    queryKey: ["pix-renovacao", pix?.paymentId],
    queryFn: () => statusPixRenovacaoFn({ data: { paymentId: pix!.paymentId } }),
    enabled: !!pix && !expirado,
    refetchInterval: (q) => (q.state.data?.status === "paid" ? false : 6_000),
  });
  const pago = situacao?.status === "paid";

  useEffect(() => {
    if (!pago) return;
    void qc.invalidateQueries({ queryKey: ["plano-atual"] });
    void qc.invalidateQueries({ queryKey: ["trial-status"] });
    void qc.invalidateQueries({ queryKey: ["historico-pagamentos"] });
  }, [pago, qc]);

  async function copiar() {
    if (!pix?.qrCode) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      toast.success("Código Pix copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  }

  return (
    <Dialog open={!!ciclo} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{pago ? "Pagamento confirmado!" : "Renovar com Pix"}</DialogTitle>
          <DialogDescription>
            {pago
              ? "Seu acesso já foi renovado. O comprovante também foi enviado para o WhatsApp da empresa."
              : pix
                ? `Plano ${pix.plano} ${pix.ciclo === "yearly" ? "anual" : "mensal"} — ${brl(pix.valor)}`
                : "Gerando o Pix…"}
          </DialogDescription>
        </DialogHeader>

        {pago && situacao?.comprovante ? (
          <Comprovante dados={situacao.comprovante} />
        ) : gerar.isPending ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : gerar.isError ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">{gerar.error.message}</p>
            <Button size="sm" onClick={() => ciclo && mutate(ciclo)}>
              Tentar de novo
            </Button>
          </div>
        ) : pix && expirado ? (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Este Pix expirou. Se você já pagou, aguarde um instante e confira o histórico; senão,
              gere outro.
            </p>
            <Button size="sm" onClick={() => ciclo && mutate(ciclo)}>
              Gerar novo Pix
            </Button>
          </div>
        ) : pix ? (
          <div className="space-y-3">
            {pix.qrCodeBase64 ? (
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code Pix"
                className="mx-auto h-52 w-52 rounded-lg bg-white p-2"
              />
            ) : (
              <QrCode className="mx-auto h-16 w-16 text-muted-foreground" />
            )}
            {pix.qrCode && (
              <>
                <textarea
                  readOnly
                  value={pix.qrCode}
                  className="w-full rounded-lg border border-input bg-secondary/40 p-2 text-xs"
                  rows={3}
                  onClick={(e) => e.currentTarget.select()}
                  aria-label="Pix copia e cola"
                />
                <Button className="w-full gap-2" onClick={copiar}>
                  <Copy className="h-4 w-4" /> Copiar código Pix
                </Button>
              </>
            )}
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando o pagamento — a
              confirmação é automática. Válido por 30 minutos.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function Comprovante({ dados }: { dados: DadosComprovante }) {
  return (
    <div className="space-y-4">
      <div id="comprovante-plano" className="rounded-xl border border-border p-4">
        <div className="mb-3 flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-bold">Comprovante de pagamento — SPACE TECH</span>
        </div>
        <dl className="space-y-1.5 text-sm">
          {linhasComprovante(dados).map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="text-right font-medium break-all">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Button variant="outline" className="w-full gap-2" onClick={() => imprimir()}>
        <Printer className="h-4 w-4" /> Imprimir / salvar PDF
      </Button>
    </div>
  );
}

/** Imprime só o comprovante (o navegador oferece "Salvar como PDF"). */
function imprimir() {
  const el = document.getElementById("comprovante-plano");
  if (!el) return;
  const janela = window.open("", "_blank", "width=480,height=640");
  if (!janela) {
    window.print();
    return;
  }
  janela.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Comprovante SPACE TECH</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    dl div{display:flex;justify-content:space-between;gap:16px;padding:4px 0;border-bottom:1px solid #eee}
    dt{color:#555} dd{margin:0;font-weight:600;text-align:right;word-break:break-all}
    svg{display:none}</style></head><body>${el.innerHTML}</body></html>`,
  );
  janela.document.close();
  janela.focus();
  janela.print();
}
