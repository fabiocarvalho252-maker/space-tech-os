import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WhatsAppModalFooter({
  enviando,
  podeEnviar,
  agendando,
  onCancelar,
  onEnviar,
}: {
  enviando: boolean;
  podeEnviar: boolean;
  agendando: boolean;
  onCancelar: () => void;
  onEnviar: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" disabled={enviando} onClick={onCancelar}>
        Cancelar
      </Button>
      <Button
        className="gap-2 bg-green-600 hover:bg-green-700"
        disabled={!podeEnviar || enviando}
        onClick={onEnviar}
      >
        {enviando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> {agendando ? "Agendar" : "Enviar agora"}
          </>
        )}
      </Button>
    </div>
  );
}
