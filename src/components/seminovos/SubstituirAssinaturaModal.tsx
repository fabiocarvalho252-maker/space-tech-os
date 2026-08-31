// "Substituir assinatura" (pedido, seção 13) — usado no detalhe de um
// aparelho já salvo, quando a assinatura original precisa ser trocada (ou
// quando um registro antigo, sem assinatura, precisa coletar uma). Diferente
// de AssinaturaCanvas usado no fluxo de compra: aqui o seminovo já existe,
// então o upload acontece na hora, mesma convenção de path de
// SeminovosFotos.tsx (`${empresaId}/${seminovoId}/...` no bucket
// seminovos-fotos) — sem bucket novo. O histórico ("Assinatura coletada" ou
// "Assinatura substituída") é gerado sozinho pela trigger
// seminovos_historico_on_update ao ver assinatura_url mudar.
import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { randomId } from "@/lib/utils";
import { AssinaturaCanvas, type AssinaturaCanvasHandle } from "./AssinaturaCanvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const BUCKET = "seminovos-fotos";

export function SubstituirAssinaturaModal({
  open,
  onOpenChange,
  seminovoId,
  empresaId,
  jaTemAssinatura,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seminovoId: string;
  empresaId: string;
  jaTemAssinatura: boolean;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<AssinaturaCanvasHandle>(null);

  const salvar = useMutation({
    mutationFn: async () => {
      const blob = await canvasRef.current?.obterBlob();
      if (!blob) throw new Error("Assine na área acima antes de salvar.");

      const path = `${empresaId}/${seminovoId}/assinatura-${randomId()}.png`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/png",
      });
      if (upErr) throw upErr;

      const { error } = await supabase
        .from("seminovos")
        .update({ assinatura_url: path, assinatura_coletada_em: new Date().toISOString() })
        .eq("id", seminovoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(jaTemAssinatura ? "Assinatura substituída" : "Assinatura coletada");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
      qc.invalidateQueries({ queryKey: ["seminovo-atual", seminovoId] });
      qc.invalidateQueries({ queryKey: ["seminovo-historico", seminovoId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            {jaTemAssinatura ? "Substituir assinatura" : "Coletar assinatura"}
          </DialogTitle>
        </DialogHeader>

        {jaTemAssinatura && (
          <p className="text-sm text-muted-foreground">
            A assinatura atual será substituída. A troca fica registrada no histórico do aparelho.
          </p>
        )}

        <AssinaturaCanvas ref={canvasRef} />

        <DialogFooter className="pt-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="h-11 gap-2"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
          >
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
