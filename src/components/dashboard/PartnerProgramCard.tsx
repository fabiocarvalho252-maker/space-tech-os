import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { meuPerfilIndicacaoFn } from "@/lib/referrals/referral.functions";

export function PartnerProgramCard() {
  const { data: perfil } = useQuery({
    queryKey: ["meu-perfil-indicacao"],
    queryFn: () => meuPerfilIndicacaoFn(),
  });

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 p-4 text-white sm:p-5 shadow-soft">
      <div>
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5" aria-hidden="true" />
          <h3 className="text-sm font-bold sm:text-base">Programa de Indicações</h3>
        </div>
        <p className="mt-1 text-xs text-white/80 sm:mt-2 sm:text-sm">
          Indique o SPACE TECH para outras assistências e acompanhe suas indicações.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-white/70">Seu código</p>
          <p className="text-base font-bold text-amber-300 sm:text-lg">
            {perfil?.referralCode ?? "—"}
          </p>
        </div>
        <Link
          to="/indicacoes"
          className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
        >
          Ver programa
        </Link>
      </div>
    </div>
  );
}
