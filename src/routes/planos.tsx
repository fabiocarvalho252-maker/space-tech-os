import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FEATURES_EXIBICAO } from "@/lib/planos/features";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — SpaceTech" },
      { name: "description", content: "Compare os planos Básico e Profissional do SpaceTech OS." },
    ],
  }),
  component: Planos,
});

function precoLabel(valor: number | null) {
  return valor === null ? "A definir" : brl(valor);
}

function Planos() {
  const navigate = useNavigate();
  const { data: user, isLoading: carregandoUser } = useCurrentUser();

  useEffect(() => {
    if (carregandoUser) return;
    if (!user) navigate({ to: "/", replace: true });
  }, [carregandoUser, user, navigate]);

  const { data: planos } = useQuery({
    queryKey: ["planos-comparativo"],
    queryFn: async () => {
      const { data: plans, error } = await supabase
        .from("plans")
        .select("id, slug, name, description, monthly_price, annual_price, annual_discount_pct")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;

      const { data: features, error: featError } = await supabase
        .from("plan_features")
        .select("plan_id, feature, enabled");
      if (featError) throw featError;

      return plans.map((p) => ({
        ...p,
        features: new Set(
          (features ?? []).filter((f) => f.plan_id === p.id && f.enabled).map((f) => f.feature),
        ),
      }));
    },
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-auth px-5 py-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <LogoMark className="h-14 w-14" />
        <LogoWord className="mt-3 text-lg" />
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">Planos SpaceTech OS</h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Compare os recursos de cada plano. Os valores comerciais ainda estão sendo definidos.
        </p>
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        {(planos ?? []).map((p) => (
          <div key={p.id} className="flex flex-col rounded-3xl border border-border bg-card p-6">
            <p className="text-lg font-extrabold">{p.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
            <div className="mt-4">
              <p className="text-2xl font-extrabold">
                {precoLabel(p.monthly_price)}
                {p.monthly_price !== null && (
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                )}
              </p>
              {p.annual_price !== null && (
                <p className="text-xs text-muted-foreground">
                  ou {brl(p.annual_price)}/ano
                  {p.annual_discount_pct !== null && ` (${p.annual_discount_pct}% de desconto)`}
                </p>
              )}
            </div>
            <Link
              to="/assinatura"
              className="mt-5 flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Falar sobre este plano
            </Link>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-4">Compare os recursos</th>
              {(planos ?? []).map((p) => (
                <th key={p.id} className="p-4 text-center">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {FEATURES_EXIBICAO.map((f) => (
              <tr key={f.feature}>
                <td className="p-4">{f.label}</td>
                {(planos ?? []).map((p) => (
                  <td key={p.id} className="p-4 text-center">
                    {p.features.has(f.feature) ? (
                      <Check className="mx-auto h-4 w-4 text-emerald-600" />
                    ) : (
                      <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          to="/dashboard"
          className="flex h-11 items-center justify-center rounded-xl bg-secondary px-6 text-sm font-semibold transition hover:opacity-90"
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
