import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, LockKeyhole, LogOut, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import {
  useCurrentUser,
  usePlanoAtual,
  usePlanoTier,
  useTrialStatus,
} from "@/hooks/useCurrentUser";
import { solicitarPlano } from "@/lib/planos.functions";
import { dataBR } from "@/lib/format";

export const Route = createFileRoute("/assinatura")({
  head: () => ({
    meta: [
      { title: "Planos — SpaceTech" },
      { name: "description", content: "Escolha o plano do SpaceTech OS para sua assistência." },
    ],
  }),
  component: Assinatura,
});

type PlanoDisponivel = {
  value: "mensal" | "trimestral" | "semestral" | "anual" | "vitalicio";
  label: string;
  descricao: string;
};

const PLANOS_DISPONIVEIS: PlanoDisponivel[] = [
  { value: "mensal", label: "Mensal", descricao: "Renovação a cada 1 mês" },
  { value: "trimestral", label: "Trimestral", descricao: "Renovação a cada 3 meses" },
  { value: "semestral", label: "Semestral", descricao: "Renovação a cada 6 meses" },
  { value: "anual", label: "Anual", descricao: "Renovação a cada 12 meses" },
];

const PLANO_LABEL: Record<string, string> = {
  trial: "Teste grátis",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  vitalicio: "Vitalício",
  suspenso: "Suspenso",
};

function statusPlano(plano: string, expirado: boolean): { label: string; tone: StatusTone } {
  if (plano === "suspenso") return { label: "Suspenso", tone: "danger" };
  if (expirado) return { label: "Expirado", tone: "danger" };
  if (plano === "trial") return { label: "Em teste", tone: "warning" };
  return { label: "Ativo", tone: "success" };
}

function Assinatura() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const { data: trial } = useTrialStatus();
  const { data: planoAtual } = usePlanoAtual();
  const { data: planoTier } = usePlanoTier();
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoDisponivel["value"] | null>(null);

  useEffect(() => {
    if (carregandoUser) return;
    if (!user) navigate({ to: "/", replace: true });
  }, [carregandoUser, user, navigate]);

  const solicitar = useMutation({
    mutationFn: (plano: PlanoDisponivel["value"]) => solicitarPlano({ data: { plano } }),
    onSuccess: (_r, plano) => {
      setPlanoEscolhido(plano);
      qc.invalidateQueries({ queryKey: ["plano-atual"] });
      toast.success("Pedido enviado! Nossa equipe vai ativar seu plano em breve.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (!user || !trial) return null;

  const bloqueado = trial.expirado;
  const status = statusPlano(planoAtual?.plano ?? "trial", trial.expirado);
  const pedidoPendente = planoAtual?.planoSolicitado ?? planoEscolhido;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-auth px-5 py-12">
      <div className="w-full max-w-3xl rounded-3xl bg-card p-8 shadow-panel">
        <div className="flex flex-col items-center text-center">
          <LogoMark className="h-14 w-14" />
          <LogoWord className="mt-3 text-lg" />

          {bloqueado ? (
            <>
              <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <LockKeyhole className="h-7 w-7" />
              </div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
                {planoAtual?.plano === "suspenso"
                  ? "Seu acesso está suspenso"
                  : "Seu período de teste terminou"}
              </h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                O acesso ao sistema foi pausado, mas seus dados continuam salvos. Escolha um plano
                abaixo para pedir a reativação.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Seu plano</h1>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Veja o status do seu acesso e peça a mudança de plano quando quiser.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Plano atual</p>
            <p className="text-lg font-bold">{PLANO_LABEL[planoAtual?.plano ?? "trial"]}</p>
            {planoAtual?.acessoAte && (
              <p className="text-xs text-muted-foreground">
                Válido até {dataBR(planoAtual.acessoAte)}
              </p>
            )}
          </div>
          <StatusBadge label={status.label} tone={status.tone} />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-4">
          <div>
            <p className="text-xs text-muted-foreground">Recursos do plano</p>
            <p className="text-lg font-bold">{planoTier?.name ?? "Básico"}</p>
          </div>
          <Link to="/planos" className="text-xs font-semibold text-primary hover:underline">
            Ver Plano Profissional
          </Link>
        </div>

        {pedidoPendente && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-600">
            <Send className="h-4 w-4 shrink-0" />
            <span>
              Pedido de plano <strong>{PLANO_LABEL[pedidoPendente]}</strong> enviado
              {planoAtual?.planoSolicitadoEm
                ? ` ${formatDistanceToNow(new Date(planoAtual.planoSolicitadoEm), { locale: ptBR, addSuffix: true })}`
                : ""}
              . Nossa equipe vai entrar em contato para confirmar e liberar o acesso.
            </span>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANOS_DISPONIVEIS.map((p) => {
            const jaSolicitado = pedidoPendente === p.value;
            return (
              <div
                key={p.value}
                className="flex flex-col justify-between rounded-2xl border border-border p-4"
              >
                <div>
                  <p className="font-bold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.descricao}</p>
                </div>
                <button
                  onClick={() => solicitar.mutate(p.value)}
                  disabled={solicitar.isPending || jaSolicitado}
                  className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-default disabled:opacity-60"
                >
                  {jaSolicitado ? (
                    <>
                      <Check className="h-4 w-4" /> Pedido enviado
                    </>
                  ) : (
                    "Quero esse plano"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button
            onClick={sair}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-input px-6 text-sm font-semibold transition hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
          {!bloqueado && (
            <Link
              to="/dashboard"
              className="flex h-11 items-center justify-center rounded-xl bg-secondary px-6 text-sm font-semibold transition hover:opacity-90"
            >
              Voltar ao painel
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
