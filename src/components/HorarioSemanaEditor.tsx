import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DIAS_SEMANA, HORARIO_COMERCIAL, type Horario } from "@/lib/whatsapp/robo";

// Editor de horário semanal (domingo a sábado): usado no horário de
// funcionamento da loja (Configurações → Empresa) e no robô do WhatsApp.
export function HorarioSemanaEditor({
  value,
  onChange,
}: {
  value: Horario;
  onChange: (h: Horario) => void;
}) {
  function mudarDia(dia: number, novo: Horario[number]) {
    onChange(value.map((d, i) => (i === dia ? novo : d)));
  }
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-background/50">
      {DIAS_SEMANA.map((nome, dia) => {
        const exp = value[dia] ?? null;
        return (
          <div key={nome} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <span className="w-20 text-sm font-medium capitalize">{nome}</span>
            <Switch
              checked={!!exp}
              onCheckedChange={(v) =>
                mudarDia(
                  dia,
                  v ? (HORARIO_COMERCIAL[dia] ?? { abre: "08:00", fecha: "12:00" }) : null,
                )
              }
              aria-label={`Aberto ${nome}`}
            />
            {exp ? (
              <span className="flex items-center gap-2 text-sm">
                <Input
                  type="time"
                  value={exp.abre}
                  onChange={(e) => mudarDia(dia, { ...exp, abre: e.target.value })}
                  className="h-8 w-28"
                  aria-label={`Abre ${nome}`}
                />
                às
                <Input
                  type="time"
                  value={exp.fecha}
                  onChange={(e) => mudarDia(dia, { ...exp, fecha: e.target.value })}
                  className="h-8 w-28"
                  aria-label={`Fecha ${nome}`}
                />
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
