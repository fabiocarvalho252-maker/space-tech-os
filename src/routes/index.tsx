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
  User,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { origemPublica } from "@/lib/site-url";
import { LogoMark, LogoWord } from "@/components/Logo";
import { vincularContaCliente } from "@/lib/cliente-conta/cliente-conta.functions";

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

// Whether the given uid is a linked customer (Área do Cliente) rather than
// staff — used both on mount (existing session) and right after a
// successful login, so each lands on the right home screen. Safe to call
// for a staff session too: the RLS customer policy only ever returns their
// own row, so a staff uid (never linked as auth_user_id) just gets null.
async function ehClienteVinculado(uid: string): Promise<boolean> {
  const { data } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- auth_user_id not in the generated Database type yet
    .from("clientes" as any)
    .select("id")
    .eq("auth_user_id", uid)
    .maybeSingle();
  return !!data;
}

function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"empresa" | "cliente">("empresa");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const user = data.session.user;
      // Coming back from confirming a customer signup email: the link
      // to `clientes` only ever gets created by vincularContaCliente(),
      // which the signup form only calls when signUp() already returns a
      // session (email confirmation disabled) — a confirmed-by-email
      // session never went through that, so it's done here instead.
      if (user.user_metadata?.["account_type"] === "cliente") {
        try {
          await vincularContaCliente();
        } catch {
          // best-effort — /minha-conta's own guard retries this
        }
        navigate({ to: "/minha-conta", replace: true });
        return;
      }
      const destino = (await ehClienteVinculado(user.id)) ? "/minha-conta" : "/dashboard";
      navigate({ to: destino, replace: true });
    });
  }, [navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative flex flex-col justify-center bg-gradient-auth px-5 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
          <div className="flex rounded-full border border-border bg-card p-1 text-xs font-semibold shadow-soft">
            <button
              type="button"
              onClick={() => setModo("empresa")}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                modo === "empresa" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Empresa
            </button>
            <button
              type="button"
              onClick={() => setModo("cliente")}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                modo === "cliente" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Área do Cliente
            </button>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-soft">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" /> 🇧🇷 PT
          </span>
        </div>

        {modo === "empresa" ? <PainelEmpresa /> : <PainelCliente />}
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

function PainelEmpresa() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
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
      redirectTo: `${origemPublica()}/redefinir-senha`,
    });
    if (error) toast.error(error.message);
    else toast.success("Enviamos um link de recuperação para o seu email");
  }

  return (
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
        <Campo icon={Mail} label="Email" type="email" value={email} onChange={setEmail} />
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
  );
}

const clienteEntrarSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  senha: z.string().min(1, "Informe sua senha"),
});

const clienteCriarSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("Email inválido"),
  telefone: z.string().trim().max(20).optional(),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

function PainelCliente() {
  const navigate = useNavigate();
  const [subModo, setSubModo] = useState<"entrar" | "criar">("entrar");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const campo = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function finalizarEntrada() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    try {
      await vincularContaCliente();
    } catch (e) {
      toast.error("Não foi possível carregar sua conta de cliente", {
        description: e instanceof Error ? e.message : undefined,
      });
      return;
    }
    navigate({ to: "/minha-conta" });
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = clienteEntrarSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.senha,
    });
    if (error) {
      setLoading(false);
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    await finalizarEntrada();
    setLoading(false);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = clienteCriarSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: origemPublica(),
        // account_type=cliente tells handle_new_user() to skip creating an
        // empresa profile for this account (see the migration).
        data: {
          account_type: "cliente",
          nome: parsed.data.nome,
          telefone: parsed.data.telefone || null,
        },
      },
    });
    if (error) {
      setLoading(false);
      toast.error("Não foi possível criar sua conta", { description: error.message });
      return;
    }
    if (data.session) {
      await finalizarEntrada();
      setLoading(false);
      return;
    }
    setLoading(false);
    setEnviado(true);
  }

  async function consultarPorNumero() {
    const osRef = prompt("Informe o número ou ID da Ordem de Serviço:");
    if (!osRef) return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(osRef);
    let query = supabase.from("ordens_servico").select("id, numero");
    query = isUuid ? query.eq("id", osRef) : query.eq("numero", Number(osRef) || -1);
    const { data, error } = await query.maybeSingle();
    if (error || !data) {
      toast.error("Ordem de Serviço não encontrada", {
        description: "Verifique o número informado e tente novamente.",
      });
      return;
    }
    navigate({ to: `/consulta/${osRef}` });
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-card p-7 shadow-panel sm:p-9">
      <div className="flex flex-col items-center">
        <LogoMark className="h-16 w-16" />
        <LogoWord className="mt-3 text-xl" />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Minha Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">
          Acompanhe suas compras e Ordens de Serviço
        </p>
      </div>

      {enviado ? (
        <div className="mt-8 rounded-2xl bg-secondary p-5 text-center text-sm">
          <p className="font-semibold">Confirme seu email</p>
          <p className="mt-1 text-muted-foreground">
            Enviamos um link de confirmação para <strong>{form.email}</strong>. Depois de confirmar,
            é só entrar.
          </p>
          <button
            onClick={() => {
              setEnviado(false);
              setSubModo("entrar");
            }}
            className="mt-4 font-semibold text-primary underline"
          >
            Ir para o login
          </button>
        </div>
      ) : subModo === "entrar" ? (
        <form onSubmit={entrar} className="mt-7 space-y-4">
          <Campo
            icon={Mail}
            label="Email"
            type="email"
            value={form.email}
            onChange={campo("email")}
          />
          <Campo
            icon={Lock}
            label="Senha"
            type="password"
            value={form.senha}
            onChange={campo("senha")}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <form onSubmit={criar} className="mt-7 space-y-4">
          <Campo icon={User} label="Seu nome" value={form.nome} onChange={campo("nome")} />
          <Campo
            icon={Mail}
            label="Email"
            type="email"
            value={form.email}
            onChange={campo("email")}
          />
          <Campo
            icon={Phone}
            label="WhatsApp (opcional)"
            value={form.telefone}
            onChange={campo("telefone")}
            placeholder="(00) 00000-0000"
            required={false}
          />
          <Campo
            icon={Lock}
            label="Senha"
            type="password"
            value={form.senha}
            onChange={campo("senha")}
          />
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Criando..." : "Criar conta"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}

      {!enviado && (
        <p className="mt-7 text-center text-sm text-muted-foreground">
          {subModo === "entrar" ? (
            <>
              Ainda não tem conta?{" "}
              <button
                type="button"
                onClick={() => setSubModo("criar")}
                className="font-semibold text-primary underline"
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button
                type="button"
                onClick={() => setSubModo("entrar")}
                className="font-semibold text-primary underline"
              >
                Entrar
              </button>
            </>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={consultarPorNumero}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
      >
        <Search className="h-3.5 w-3.5" /> Prefere não criar conta? Consultar OS pelo número
      </button>
    </div>
  );
}

function Campo({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = true,
}: {
  icon: React.ElementType;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
        />
      </div>
    </div>
  );
}
