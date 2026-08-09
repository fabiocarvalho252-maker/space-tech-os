import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  Printer,
  Package,
  Wallet,
  Wrench,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SPACE TECH OS — Gestão inteligente para assistência técnica" },
      {
        name: "description",
        content:
          "Acesse sua assistência: ordens de serviço, PDV, estoque e financeiro em um único sistema.",
      },
      { property: "og:title", content: "Entrar no SpaceTech" },
      {
        property: "og:description",
        content: "OS, PDV, estoque e financeiro para assistências técnicas.",
      },
    ],
  }),
  component: Login,
});

const BENEFICIOS = [
  { icon: Printer, text: "OS profissional com impressão" },
  { icon: Package, text: "PDV com baixa automática no estoque" },
  { icon: Wallet, text: "Financeiro com controle de entradas e saídas" },
  { icon: Wrench, text: "Ferramentas técnicas para assistência" },
];

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function recuperar() {
    if (!email) {
      toast.error("Informe seu email para recuperar a senha");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para o seu email");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative flex flex-col justify-center bg-gradient-auth px-5 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-md items-center justify-between pb-8">
          <button
            onClick={async () => {
              const osRef = prompt("Informe o número ou ID da Ordem de Serviço:");
              if (!osRef) return;

              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                osRef,
              );

              let query = supabase.from("ordens_servico").select("id, numero");

              if (isUuid) {
                query = query.eq("id", osRef);
              } else {
                const num = parseInt(osRef);
                if (isNaN(num)) {
                  toast.error("Número de OS inválido");
                  return;
                }
                query = query.eq("numero", num);
              }

              const { data, error } = await query.maybeSingle();

              if (error) {
                toast.error("Erro ao validar OS");
                return;
              }

              if (!data) {
                toast.error("Ordem de Serviço não encontrada", {
                  description: "Verifique o número informado e tente novamente.",
                });
                return;
              }

              navigate({ to: `/consulta/${osRef}` });
            }}
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1.5"
          >
            <Search className="h-4 w-4" /> Área do Cliente
          </button>
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-soft">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" /> 🇧🇷 PT
          </span>
        </div>

        <div className="mx-auto w-full max-w-md rounded-3xl bg-card p-7 shadow-panel sm:p-9">
          <div className="flex flex-col items-center">
            <LogoMark className="h-16 w-16" />
            <LogoWord className="mt-3 text-xl" />
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight">SpaceTech OS</h1>
            <p className="mt-1 text-sm text-muted-foreground text-center">
              Gestão inteligente para assistência técnica
            </p>
          </div>

          <form onSubmit={entrar} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-semibold">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="senha" className="text-sm font-semibold">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="senha"
                  type={ver ? "text" : "password"}
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-11 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label="Mostrar senha"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="h-4 w-4 rounded border-input accent-primary" />
                Lembrar de mim
              </label>
              <button type="button" onClick={recuperar} className="font-semibold text-primary">
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-semibold text-primary underline">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-ink px-12 py-16 lg:flex lg:flex-col lg:justify-center">
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="relative max-w-lg">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-ink-muted">
            Sistema completo para assistência técnica
          </span>
          <h2 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight text-ink-foreground">
            Controle sua
            <br />
            assistência de ponta a ponta.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">
            Gerencie ordens de serviço, clientes, aparelhos, estoque, financeiro e comunicação com
            seus clientes em um único sistema moderno e profissional.
          </p>
          <ul className="mt-10 space-y-4">
            {BENEFICIOS.map((b) => (
              <li key={b.text} className="flex items-center gap-3 text-ink-foreground/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-ink-muted">
                  <b.icon className="h-4 w-4" />
                </span>
                {b.text}
              </li>
            ))}
          </ul>
          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {[
              ["7 dias grátis", "Teste completo"],
              ["Sem cartão", "Todos os recursos"],
              ["Cancele fácil", "Sem burocracia"],
            ].map(([t, s]) => (
              <div key={t}>
                <p className="text-sm font-bold text-ink-foreground">{t}</p>
                <p className="text-xs text-ink-muted">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
