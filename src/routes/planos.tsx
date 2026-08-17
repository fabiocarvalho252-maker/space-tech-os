import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { FEATURES_EXIBICAO } from "@/lib/planos/features";
import { iniciarAssinaturaFn } from "@/lib/mercadopago/subscription.functions";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlanoComFeatures = {
  id: string;
  name: string;
  monthly_price: number | null;
  annual_price: number | null;
};

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
  const [planoContratando, setPlanoContratando] = useState<PlanoComFeatures | null>(null);

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
            {p.monthly_price !== null || p.annual_price !== null ? (
              <Button className="mt-5" onClick={() => setPlanoContratando(p)}>
                Contratar
              </Button>
            ) : (
              <Link
                to="/assinatura"
                className="mt-5 flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Falar sobre este plano
              </Link>
            )}
          </div>
        ))}
      </div>

      <ContratarDialog
        plano={planoContratando}
        onOpenChange={(v) => !v && setPlanoContratando(null)}
      />

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

function ContratarDialog({
  plano,
  onOpenChange,
}: {
  plano: PlanoComFeatures | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [pix, setPix] = useState<{ qrCode: string | null; qrCodeBase64: string | null } | null>(
    null,
  );

  const contratar = useMutation({
    mutationFn: () =>
      iniciarAssinaturaFn({ data: { planId: plano!.id, billingCycle, paymentMethod } }),
    onSuccess: (resultado) => {
      if (resultado.paymentMethod === "credit_card") {
        window.location.href = resultado.initPoint;
        return;
      }
      setPix({ qrCode: resultado.qrCode, qrCodeBase64: resultado.qrCodeBase64 });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!plano) return null;
  const precoDisponivel =
    billingCycle === "monthly" ? plano.monthly_price !== null : plano.annual_price !== null;

  return (
    <Dialog
      open={!!plano}
      onOpenChange={(v) => {
        if (!v) setPix(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contratar {plano.name}</DialogTitle>
          <DialogDescription>
            {pix
              ? "Escaneie o QR Code ou use o Pix Copia e Cola."
              : "Escolha a periodicidade e a forma de pagamento."}
          </DialogDescription>
        </DialogHeader>

        {pix ? (
          <div className="space-y-3 text-center">
            {pix.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${pix.qrCodeBase64}`}
                alt="QR Code Pix"
                className="mx-auto h-48 w-48"
              />
            )}
            {pix.qrCode && (
              <textarea
                readOnly
                value={pix.qrCode}
                className="w-full rounded-lg border border-input bg-secondary/40 p-2 text-xs"
                rows={3}
                onClick={(e) => e.currentTarget.select()}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Após o pagamento, a confirmação é automática — pode levar alguns instantes.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Select
              value={billingCycle}
              onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "pix" | "credit_card")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="credit_card">Cartão de crédito</SelectItem>
              </SelectContent>
            </Select>
            {!precoDisponivel && (
              <p className="text-xs text-destructive">
                O preço {billingCycle === "monthly" ? "mensal" : "anual"} deste plano ainda não foi
                configurado.
              </p>
            )}
            <Button
              className="w-full"
              disabled={!precoDisponivel || contratar.isPending}
              onClick={() => contratar.mutate()}
            >
              {contratar.isPending ? "Processando..." : "Continuar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
