import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LockKeyhole, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { useCurrentUser, useTrialStatus } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/assinatura")({
  head: () => ({
    meta: [
      { title: "Período de teste encerrado — SpaceTech" },
      { name: "description", content: "Seu período de teste grátis terminou." },
    ],
  }),
  component: Assinatura,
});

function Assinatura() {
  const navigate = useNavigate();
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const { data: trial, isLoading: carregandoTrial } = useTrialStatus();

  useEffect(() => {
    if (carregandoUser) return;
    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }
    if (!carregandoTrial && trial && !trial.expirado) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [carregandoUser, carregandoTrial, user, trial, navigate]);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-auth px-5 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 text-center shadow-panel">
        <div className="flex flex-col items-center">
          <LogoMark className="h-14 w-14" />
          <LogoWord className="mt-3 text-lg" />
          <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
            Seu período de teste terminou
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seus 7 dias grátis no SpaceTech OS acabaram e o acesso ao sistema foi pausado. Fale com
            a gente para ativar um plano e continuar de onde parou — seus dados continuam salvos.
          </p>
        </div>

        <button
          onClick={sair}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-input text-sm font-semibold transition hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>
    </div>
  );
}
