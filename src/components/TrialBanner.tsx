import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTrialStatus } from "@/hooks/useCurrentUser";
import { avisarTrialPorEmail } from "@/lib/trial.functions";

const AVISAR_A_PARTIR_DE = 3;

export function TrialBanner() {
  const { data: trial } = useTrialStatus();
  const [fechado, setFechado] = useState(false);
  const diasRestantesEmail = trial?.diasRestantes;

  useEffect(() => {
    if (diasRestantesEmail !== undefined && diasRestantesEmail <= AVISAR_A_PARTIR_DE) {
      avisarTrialPorEmail().catch(() => {});
    }
  }, [diasRestantesEmail]);

  if (!trial || fechado) return null;
  const { diasRestantes, expirado } = trial;
  if (diasRestantes > AVISAR_A_PARTIR_DE) return null;

  const mensagem = expirado
    ? `Seu período de teste grátis expirou${diasRestantes < -1 ? ` há ${Math.abs(diasRestantes)} dias` : diasRestantes === -1 ? " há 1 dia" : ""}.`
    : diasRestantes === 0
      ? "Seu período de teste grátis termina hoje."
      : `Seu período de teste grátis termina em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}.`;

  return (
    <div
      className={`mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
        expirado
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          {mensagem}{" "}
          {expirado
            ? "Fale com a gente para continuar usando o SpaceTech."
            : "Ative um plano para não perder o acesso."}
        </span>
      </div>
      <button
        onClick={() => setFechado(true)}
        className="shrink-0 text-xs font-semibold underline opacity-70 hover:opacity-100"
      >
        Fechar
      </button>
    </div>
  );
}
