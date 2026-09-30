// /admin → "Quem mais indica": ranking das empresas que indicam, com o
// desconto de mensalidade que cada uma tem/usou e as bonificações em Pix já
// registradas. A bonificação é paga pelo admin no banco (fora do sistema);
// aqui só fica o registro, que também aparece para a empresa em /indicacoes.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/MoneyInput";
import { brl, dataBR } from "@/lib/format";
import {
  listarIndicadoresFn,
  registrarBonificacaoPixFn,
  type Indicador,
} from "@/lib/referrals/admin-referral.functions";

export function IndicadoresCard({ souAdmin }: { souAdmin: boolean }) {
  const [bonificando, setBonificando] = useState<Indicador | null>(null);
  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["site-admin-indicadores"],
    queryFn: () => listarIndicadoresFn(),
    enabled: souAdmin,
  });

  if (!souAdmin) return null;

  return (
    <SectionCard
      title="Quem mais indica"
      subtitle="R$ 10 de desconto na próxima mensalidade por indicação que assina. Para quem indica muito, registre uma bonificação em Pix."
      icon={Trophy}
      className="mb-6"
    >
      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Erro ao carregar."}
        </p>
      ) : !data.length ? (
        <EmptyState icon={Trophy} title="Nenhuma indicação ainda" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2 text-center">Indicações</th>
                <th className="px-3 py-2 text-center">Assinaram</th>
                <th className="px-3 py-2">Desconto</th>
                <th className="px-3 py-2">Bonificações Pix</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((i) => {
                const totalBonus = i.bonificacoesPix.reduce((s, b) => s + b.valor, 0);
                return (
                  <tr key={i.empresaId} className="hover:bg-secondary/30">
                    <td className="px-3 py-3">
                      <p className="font-medium">{i.loja || i.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {i.email || "—"} · código {i.referralCode}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">{i.totalIndicacoes}</td>
                    <td className="px-3 py-3 text-center font-semibold">{i.convertidas}</td>
                    <td className="px-3 py-3">
                      <p>{brl(i.descontoDisponivel)} disponível</p>
                      {i.descontoUsado > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {brl(i.descontoUsado)} já usado
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {i.bonificacoesPix.length ? (
                        <>
                          <p className="font-semibold text-emerald-600">{brl(totalBonus)}</p>
                          <p className="text-xs text-muted-foreground">
                            última em {dataBR(i.bonificacoesPix[0]!.pagoEm)}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setBonificando(i)}>
                        <Wallet className="h-4 w-4" /> Bonificar em Pix
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BonificacaoDialog indicador={bonificando} onClose={() => setBonificando(null)} />
    </SectionCard>
  );
}

function BonificacaoDialog({
  indicador,
  onClose,
}: {
  indicador: Indicador | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [nota, setNota] = useState("");

  const registrar = useMutation({
    mutationFn: () =>
      registrarBonificacaoPixFn({
        data: {
          empresaId: indicador!.empresaId,
          valor: Number(valor),
          chavePix: chavePix.trim() || undefined,
          nota: nota.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Bonificação registrada.");
      qc.invalidateQueries({ queryKey: ["site-admin-indicadores"] });
      setValor("");
      setChavePix("");
      setNota("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nome = indicador ? indicador.loja || indicador.nome || "esta empresa" : "";
  const valido = Number(valor) > 0;

  return (
    <Dialog open={!!indicador} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Bonificar {nome} em Pix</DialogTitle>
          <DialogDescription>
            Faça o Pix pelo seu banco e registre aqui o valor pago. O registro aparece para a
            empresa na tela de Indicações.
            {indicador && ` (${indicador.convertidas} indicação(ões) que assinaram)`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Valor pago (R$)</Label>
            <MoneyInput value={valor} onChange={(v) => setValor(String(v))} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chave Pix usada (opcional)</Label>
            <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observação (opcional)</Label>
            <Input
              value={nota}
              placeholder="Ex.: 5 indicações em setembro"
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!valido || registrar.isPending}
            onClick={() => registrar.mutate()}
          >
            {registrar.isPending
              ? "Registrando..."
              : valido
                ? `Registrar ${brl(Number(valor))} pago`
                : "Registrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
