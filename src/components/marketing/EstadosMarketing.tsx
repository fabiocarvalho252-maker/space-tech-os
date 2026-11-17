// Estados padrão da aba de marketing: carregando (esqueleto), erro com nova
// tentativa. Usados pela página inteira para ficarem iguais em todas as abas.
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EstadoCarregando() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}

export function EstadoErro({
  mensagem,
  onTentar,
  tentando = false,
}: {
  mensagem: string;
  onTentar: () => void;
  tentando?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {mensagem}
      </p>
      <Button variant="outline" size="sm" onClick={onTentar} disabled={tentando}>
        <RefreshCw className={tentando ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> Tentar de
        novo
      </Button>
    </div>
  );
}
