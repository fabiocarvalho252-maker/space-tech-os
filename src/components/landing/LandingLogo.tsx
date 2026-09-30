import { Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

// Marca da landing — mesma identidade do LogoMark/LogoWord do app, mas sem
// consultar o perfil logado (a landing é pública).
export function LandingLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 shadow-lg shadow-violet-900/40">
        <Rocket className="h-4.5 w-4.5 text-white" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="text-base font-extrabold tracking-tight text-white">
        SPACE <span className="text-violet-400">TECH</span>{" "}
        <span className="ml-0.5 text-xs font-bold text-zinc-400">OS</span>
      </span>
    </span>
  );
}
