import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { possuiVariaveisNaoPreenchidas } from "@/lib/whatsapp";

const LIMITE_CARACTERES = 4096;

export function WhatsAppMessageEditor({
  value,
  onChange,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const faltamVariaveis = possuiVariaveisNaoPreenchidas(value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="whatsapp-notif-mensagem">Mensagem (pode editar antes de enviar)</Label>
      <Textarea
        id="whatsapp-notif-mensagem"
        ref={inputRef}
        className="min-h-[130px] resize-y text-sm"
        maxLength={LIMITE_CARACTERES}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between text-xs">
        {faltamVariaveis ? (
          <p className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Ainda há variáveis sem preencher (
            {"{cliente}"}, {"{numero_os}"} etc.).
          </p>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">
          {value.length}/{LIMITE_CARACTERES}
        </span>
      </div>
    </div>
  );
}
