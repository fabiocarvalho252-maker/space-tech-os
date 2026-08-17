import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Clock, Copy, Gift, Send, Users, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { meuPerfilIndicacaoFn } from "@/lib/referrals/referral.functions";
import { getReferralLink } from "@/lib/referrals/link";

export const Route = createFileRoute("/_authenticated/indicacoes")({
  head: () => ({
    meta: [
      { title: "Programa de Indicações — SpaceTech" },
      {
        name: "description",
        content: "Seu link e código de indicação, e o andamento das suas indicações.",
      },
    ],
  }),
  component: Indicacoes,
});

function Indicacoes() {
  const empresaId = useEmpresaId();
  const [copiado, setCopiado] = useState(false);

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["meu-perfil-indicacao"],
    queryFn: () => meuPerfilIndicacaoFn(),
  });

  const { data: referrals = [] } = useQuery({
    queryKey: ["minhas-indicacoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("id, status")
        .eq("referrer_empresa_id", empresaId as string);
      if (error) throw error;
      return data;
    },
  });

  const totalIndicacoes = referrals.length;
  const convertidas = referrals.filter((r) => r.status === "converted").length;
  const pendentes = referrals.filter(
    (r) => r.status === "registered" || r.status === "pending",
  ).length;

  const link = perfil ? getReferralLink(perfil.referralCode) : "";
  const mensagem = perfil
    ? (perfil.whatsappShareMessage || "Conheça o SPACE TECH:\n{LINK}").replace("{LINK}", link)
    : "";

  function copiarLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function compartilharWhatsapp() {
    if (!mensagem) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank");
  }

  return (
    <div>
      <PageHeader
        title="Programa de Indicações"
        subtitle="Indique o SPACE TECH para outras assistências."
      />

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-secondary/40" />
      ) : !perfil ? (
        <SectionCard>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar seu perfil de indicação. Tente novamente em instantes.
          </p>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {!perfil.programAtivo && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              O programa de indicações ainda não foi ativado — seu código já está reservado e pronto
              para quando ele entrar no ar.
            </div>
          )}

          {perfil.programDescription && (
            <p className="text-sm text-muted-foreground">{perfil.programDescription}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile icon={Users} label="Total de indicações" valor={totalIndicacoes} />
            <StatTile icon={UserCheck} label="Convertidas" valor={convertidas} />
            <StatTile icon={Clock} label="Pendentes" valor={pendentes} />
          </div>

          <SectionCard title="Seu link de indicação" icon={Gift}>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-10 flex-1 truncate rounded-lg border border-input bg-muted/30 px-3 text-xs text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={copiarLink}
                >
                  {copiado ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Seu código:{" "}
                  <span className="font-bold text-foreground">{perfil.referralCode}</span>
                </p>
              </div>

              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 sm:w-auto"
                onClick={compartilharWhatsapp}
              >
                <Send className="h-4 w-4" /> Compartilhar no WhatsApp
              </Button>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  valor,
}: {
  icon: typeof Users;
  label: string;
  valor: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
