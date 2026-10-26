import { useState } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { iniciais } from "./util";

/**
 * Foto de perfil do WhatsApp quando houver (URL do servidor do WhatsApp,
 * sem enviar de qual página veio); senão, as iniciais.
 */
export function Avatar({
  nome,
  foto,
  className,
  destaque = true,
}: {
  nome: string | null;
  foto: string | null | undefined;
  className?: string;
  destaque?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const base = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
    destaque ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
    className,
  );
  if (foto && !falhou) {
    return (
      <span className={base}>
        <img
          src={foto}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFalhou(true)}
        />
      </span>
    );
  }
  return (
    <span className={base} aria-hidden>
      {nome ? iniciais(nome) : <UserRound className="h-1/2 w-1/2" />}
    </span>
  );
}
