import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { WhatsAppSchedule } from "@/lib/whatsapp";

export function WhatsAppScheduleOptions({
  value,
  onChange,
}: {
  value: WhatsAppSchedule;
  onChange: (value: WhatsAppSchedule) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>Quando enviar</Label>
      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="whatsapp-notif-agendamento"
            checked={value.tipo === "agora"}
            onChange={() => onChange({ tipo: "agora" })}
            className="h-4 w-4 accent-primary"
          />
          Enviar agora
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="whatsapp-notif-agendamento"
            checked={value.tipo === "fila"}
            onChange={() =>
              onChange({
                tipo: "fila",
                data: value.tipo === "fila" ? value.data : "",
                hora: value.tipo === "fila" ? value.hora : "",
              })
            }
            className="h-4 w-4 accent-primary"
          />
          Agendar na fila
        </label>
      </div>

      {value.tipo === "fila" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3 animate-in fade-in slide-in-from-top-1">
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp-notif-data" className="text-xs">
              Data
            </Label>
            <Input
              id="whatsapp-notif-data"
              type="date"
              value={value.data}
              onChange={(e) => onChange({ ...value, data: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp-notif-hora" className="text-xs">
              Horário
            </Label>
            <Input
              id="whatsapp-notif-hora"
              type="time"
              value={value.hora}
              onChange={(e) => onChange({ ...value, hora: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
