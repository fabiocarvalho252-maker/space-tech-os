import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";

// Landing page for the "Esqueci minha senha" e-mail link
// (supabase.auth.resetPasswordForEmail's redirectTo, see /). Supabase-js
// parses the recovery access_token out of the URL fragment on load
// (detectSessionInUrl defaults to true) and fires a PASSWORD_RECOVERY
// auth event once that session is set — only then do we allow submitting
// a new password via supabase.auth.updateUser().
export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Redefinir senha — SpaceTech" }],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPronto(true);
    });
    // Session may already be set by the time this effect runs (event fired
    // before the listener was attached), so also check directly.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não coincidem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível redefinir a senha", { description: error.message });
      return;
    }
    await supabase.auth.signOut();
    setConcluido(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-auth px-5 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-panel">
        <div className="flex flex-col items-center">
          <LogoMark className="h-14 w-14" />
          <LogoWord className="mt-3 text-lg" />
          {concluido ? (
            <>
              <CheckCircle2 className="mt-6 h-12 w-12 text-success" />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-center">
                Senha redefinida!
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Sua senha foi alterada. Entre novamente usando a nova senha.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-center">
                Redefinir senha
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                Escolha uma nova senha para sua conta
              </p>
            </>
          )}
        </div>

        {concluido ? (
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95"
          >
            Ir para o login <ArrowRight className="h-4 w-4" />
          </button>
        ) : pronto ? (
          <form onSubmit={salvar} className="mt-7 space-y-4">
            <Campo label="Nova senha" value={senha} onChange={setSenha} />
            <Campo label="Confirmar nova senha" value={confirmar} onChange={setConfirmar} />
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar nova senha"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <p className="mt-7 text-center text-sm text-muted-foreground">
            Link inválido ou expirado.{" "}
            <Link to="/" className="font-semibold text-primary underline">
              Voltar para o login
            </Link>{" "}
            e solicite um novo.
          </p>
        )}
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="password"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
        />
      </div>
    </div>
  );
}
