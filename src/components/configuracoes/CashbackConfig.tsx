// Configurações → Empresa → Cashback: percentual que vira crédito do cliente
// em cada OS faturada e venda com cliente, validade e quanto da próxima
// compra o cashback pode pagar. Desligado por padrão.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { useConfigCashback } from "@/components/cashback/UsarCashback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CashbackConfig() {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const { data: atual } = useConfigCashback();
  const [cfg, setCfg] = useState({ ativo: false, percentual: 5, validade: 90, usoMax: 50 });

  useEffect(() => {
    if (atual)
      setCfg({
        ativo: atual.ativo,
        percentual: Number(atual.percentual),
        validade: atual.validade_dias,
        usoMax: atual.uso_max_percentual,
      });
  }, [atual]);

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cashback_config").upsert(
        {
          user_id: empresaId!,
          ativo: cfg.ativo,
          percentual: cfg.percentual,
          validade_dias: cfg.validade,
          uso_max_percentual: cfg.usoMax,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cashback salvo");
      qc.invalidateQueries({ queryKey: ["cashback-config"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Gift className="h-5 w-5 text-primary" /> Cashback
          </h2>
          <p className="text-sm text-muted-foreground">
            Uma parte de cada OS faturada e de cada venda com cliente vira crédito para o cliente
            usar como desconto na próxima vez (no PDV e no faturamento da OS). Cancelar o
            faturamento ou a venda desfaz o crédito e devolve o que foi usado.
          </p>
        </div>
        <Switch
          checked={cfg.ativo}
          onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })}
          aria-label="Ligar cashback"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Cashback (% do valor pago)</Label>
          <Input
            type="number"
            min={0.5}
            max={50}
            step={0.5}
            value={cfg.percentual}
            onChange={(e) =>
              setCfg({
                ...cfg,
                percentual: Math.min(50, Math.max(0.5, Number(e.target.value) || 0.5)),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Validade do crédito (dias)</Label>
          <Input
            type="number"
            min={7}
            max={730}
            value={cfg.validade}
            onChange={(e) =>
              setCfg({ ...cfg, validade: Math.min(730, Math.max(7, Number(e.target.value) || 7)) })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Pode pagar até (% da compra)</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={cfg.usoMax}
            onChange={(e) =>
              setCfg({ ...cfg, usoMax: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Ex.: com {cfg.percentual}%, uma OS de R$ 200 gera R${" "}
        {((200 * cfg.percentual) / 100).toFixed(2).replace(".", ",")} de crédito, válido por{" "}
        {cfg.validade} dias. Vale só para o que for faturado/vendido depois de ligar.
      </p>
      <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !empresaId}>
        Salvar cashback
      </Button>
    </section>
  );
}
