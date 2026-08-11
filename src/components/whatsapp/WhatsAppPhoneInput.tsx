import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { digitsOnlyBR, maskPhoneBR } from "@/lib/whatsapp";

export function WhatsAppPhoneInput({
  value,
  onChange,
  valido,
}: {
  value: string;
  onChange: (value: string) => void;
  valido: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="whatsapp-notif-telefone">WhatsApp do cliente (com DDD)</Label>
      <Input
        id="whatsapp-notif-telefone"
        value={value}
        onChange={(e) => onChange(maskPhoneBR(e.target.value))}
        placeholder="(74) 99999-9999"
        aria-invalid={!valido && value.length > 0}
        className={
          !valido && value.length > 0 ? "border-destructive focus-visible:ring-destructive" : ""
        }
      />
      {!valido && value.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> Telefone incompleto — inclua o DDD.
        </p>
      )}
      {digitsOnlyBR(value).length === 0 && (
        <p className="text-xs text-muted-foreground">Cliente sem telefone cadastrado.</p>
      )}
    </div>
  );
}
