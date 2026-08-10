import { Gift } from "lucide-react";

// No backend table backs a partner balance anywhere in this system yet (no
// "parceiro"/saldo schema exists), so this stays a promotional stub instead
// of showing a fabricated number — swap the static copy for a real query the
// day that program actually ships.
export function PartnerProgramCard() {
  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-5 text-white shadow-soft">
      <div>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5" aria-hidden="true" />
          <h3 className="text-base font-bold">Programa de Parceiros</h3>
        </div>
        <p className="mt-2 text-sm text-white/80">
          Acumule vantagens indicando fornecedores e parceiros para outras assistências.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-white/70">Saldo disponível</p>
          <p className="text-lg font-bold text-amber-300">Em breve</p>
        </div>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white/80"
          title="Programa em desenvolvimento"
        >
          Ver programa
        </button>
      </div>
    </div>
  );
}
