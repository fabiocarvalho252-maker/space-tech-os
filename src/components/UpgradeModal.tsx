import { Check, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RECURSOS_PROFISSIONAL = [
  "Nota Fiscal",
  "IA Profissional",
  "IA Financeira",
  "IA de Vendas",
  "IA de Estoque",
  "IA para OS",
  "Relatórios avançados",
];

// Shown whenever a Básico account hits a requireFeature() gate — client-side
// (hiding the button) or server-side (the mutation/query throws a
// FeatureIndisponivelError, see src/lib/planos/features.ts). Same modal
// either way, so every gated feature looks and behaves consistently.
export function UpgradeModal({
  open,
  onOpenChange,
  titulo = "Recurso exclusivo do Plano Profissional",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {titulo}
          </DialogTitle>
          <DialogDescription>
            Este recurso não está disponível no seu plano atual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl bg-secondary/40 p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Recursos disponíveis no Profissional
          </p>
          <ul className="space-y-1.5 text-sm">
            {RECURSOS_PROFISSIONAL.map((r) => (
              <li key={r} className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                {r}
              </li>
            ))}
          </ul>
        </div>

        <Button asChild className="w-full">
          <Link to="/planos" onClick={() => onOpenChange(false)}>
            Ver Plano Profissional
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
