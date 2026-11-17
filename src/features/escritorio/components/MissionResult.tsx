import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MissionResult({ texto }: { texto: string | null }) {
  const [copiado, setCopiado] = useState(false);

  if (!texto) {
    return (
      <p className="text-sm text-muted-foreground">
        O resultado aparece aqui quando a missão terminar.
      </p>
    );
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-line text-sm leading-relaxed">{texto}</p>
      <Button variant="outline" className="self-start gap-2" onClick={copiar}>
        <Copy className="h-4 w-4" /> {copiado ? "Copiado" : "Copiar resultado"}
      </Button>
    </div>
  );
}
