import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Lock, Mail, Store, User, Phone } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { origemPublica } from "@/lib/site-url";
import { isValidPhoneBR, maskPhoneBR, normalizarWhatsappBR } from "@/lib/whatsapp";
import {
  enviarCodigoAtivacao,
  verificarWhatsappDisponivel,
} from "@/lib/auth/ativacao-whatsapp.functions";
import { LogoMark, LogoWord } from "@/components/Logo";
import { VerificacaoWhatsappForm } from "@/components/VerificacaoWhatsappForm";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta grátis — SpaceTech" },
      {
        name: "description",
        content: "Crie sua conta no SpaceTech e organize ordens de serviço, estoque e financeiro.",
      },
      { property: "og:title", content: "Criar conta grátis — SpaceTech" },
      { property: "og:description", content: "Teste o SpaceTech por 7 dias, sem cartão." },
    ],
  }),
  component: Cadastro,
});

const schema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
  loja: z.string().trim().min(2, "Informe o nome da assistência").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  whatsapp: z.string().refine(isValidPhoneBR, "WhatsApp inválido — informe DDD + número"),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres").max(72),
});

function mensagemErroAmigavel(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : "";
  if (/already registered|user already exists/i.test(texto))
    return "Este e-mail já está cadastrado.";
  if (/whatsapp.*já|duplicate.*whatsapp/i.test(texto))
    return "Este WhatsApp já está vinculado a uma conta.";
  return texto || "Não foi possível concluir a operação.";
}

type Etapa = "form" | "verificar" | "sucesso";

function Cadastro() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", loja: "", email: "", whatsapp: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("form");
  const [whatsappMascarado, setWhatsappMascarado] = useState("");
  const [cooldownInicial, setCooldownInicial] = useState(60);

  const campo = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({
      ...f,
      [k]: k === "whatsapp" ? maskPhoneBR(e.target.value) : e.target.value,
    }));

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);

    const whatsappNormalizado = normalizarWhatsappBR(parsed.data.whatsapp);
    const disponibilidade = await verificarWhatsappDisponivel({
      data: { whatsapp: whatsappNormalizado },
    }).catch(() => null);
    if (disponibilidade && !disponibilidade.disponivel) {
      setLoading(false);
      toast.error("Este WhatsApp já está vinculado a uma conta.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.senha,
      options: {
        emailRedirectTo: origemPublica(),
        data: {
          nome: parsed.data.nome,
          loja: parsed.data.loja,
          whatsapp: whatsappNormalizado,
        },
      },
    });
    if (error || !data.session) {
      setLoading(false);
      toast.error("Não foi possível criar a conta", { description: mensagemErroAmigavel(error) });
      return;
    }

    try {
      const resultado = await enviarCodigoAtivacao();
      setWhatsappMascarado(resultado.whatsappMascarado);
      setCooldownInicial(resultado.cooldownSegundos);
      setEtapa("verificar");
    } catch (erroEnvio) {
      toast.error("Não foi possível enviar o código de ativação", {
        description: mensagemErroAmigavel(erroEnvio),
      });
    } finally {
      setLoading(false);
    }
  }

  async function aoAtivar() {
    await supabase.auth.signOut();
    setEtapa("sucesso");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-auth px-5 py-12">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-panel">
        <div className="flex flex-col items-center">
          <LogoMark className="h-14 w-14" />
          <LogoWord className="mt-3 text-lg" />
          {etapa === "form" && (
            <>
              <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Criar conta</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                7 dias grátis, sem cartão de crédito
              </p>
            </>
          )}
          {etapa === "verificar" && (
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-center">
              Verifique seu WhatsApp
            </h1>
          )}
          {etapa === "sucesso" && (
            <>
              <CheckCircle2 className="mt-6 h-12 w-12 text-success" />
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-center">
                Conta ativada com sucesso!
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Sua conta SPACE TECH OS foi ativada. Agora você pode entrar usando seu e-mail e
                senha.
              </p>
            </>
          )}
        </div>

        {etapa === "form" && (
          <form onSubmit={criar} className="mt-7 space-y-4">
            <Campo icon={User} label="Seu nome" value={form.nome} onChange={campo("nome")} />
            <Campo
              icon={Store}
              label="Nome da assistência"
              value={form.loja}
              onChange={campo("loja")}
            />
            <Campo
              icon={Phone}
              label="WhatsApp"
              value={form.whatsapp}
              onChange={campo("whatsapp")}
              placeholder="(00) 00000-0000"
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Seu WhatsApp será utilizado para ativar sua conta.
            </p>
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
              {loading ? "Criando..." : "Criar conta grátis"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {etapa === "verificar" && (
          <div className="mt-7">
            <VerificacaoWhatsappForm
              whatsappMascarado={whatsappMascarado}
              cooldownInicial={cooldownInicial}
              onAtivado={aoAtivar}
            />
          </div>
        )}

        {etapa === "sucesso" && (
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-95"
          >
            Ir para o login <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {etapa === "form" && (
          <p className="mt-7 text-center text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/" className="font-semibold text-primary underline">
              Entrar
            </Link>
          </p>
        )}
      </div>
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
}: {
  icon: React.ElementType;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold">{label}</label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/12"
        />
      </div>
    </div>
  );
}
