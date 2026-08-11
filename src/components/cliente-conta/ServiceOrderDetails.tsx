import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { tonOsStatus } from "./status";
import type { MinhaOs, MinhaOsFoto } from "./types";

type OsItem = {
  id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  tipo: string;
};

export function ServiceOrderDetails({
  os,
  open,
  onOpenChange,
}: {
  os: MinhaOs | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: itens } = useQuery({
    queryKey: ["minha-conta-os-itens", os?.id],
    enabled: open && !!os,
    queryFn: async (): Promise<OsItem[]> => {
      const { data, error } = await supabase
        .from("os_itens")
        .select("id, descricao, quantidade, preco_unitario, tipo")
        .eq("os_id", os!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fotos } = useQuery({
    queryKey: ["minha-conta-os-fotos", os?.id],
    enabled: open && !!os,
    queryFn: async (): Promise<MinhaOsFoto[]> => {
      const { data, error } = await supabase
        .from("service_order_photos")
        .select("id, url, category, created_at")
        .eq("service_order_id", os!.id);
      if (error) throw error;
      return (data ?? []) as unknown as MinhaOsFoto[];
    },
  });

  const qc = useQueryClient();
  const [confirmando, setConfirmando] = useState<"aprovar" | "reprovar" | null>(null);

  const decidir = useMutation({
    mutationFn: async (aprovar: boolean) => {
      const { error } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cliente_decidir_orcamento not in the generated Database type yet
        "cliente_decidir_orcamento" as any,
        {
          p_os_id: os!.id,
          p_aprovar: aprovar,
        },
      );
      if (error) throw error;
    },
    onSuccess: (_data, aprovar) => {
      toast.success(aprovar ? "Orçamento aprovado!" : "Orçamento reprovado.");
      qc.invalidateQueries({ queryKey: ["minha-conta-todas-os"] });
      qc.invalidateQueries({ queryKey: ["minha-conta-ultimas-os"] });
      setConfirmando(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!os) return null;

  const valorFinal = os.valor - os.desconto;
  const aguardandoAprovacao = os.status === "aguardando_aprovacao";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              OS #{os.numero}
              <StatusBadge label={statusLabel(os.status)} tone={tonOsStatus(os.status)} />
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 text-sm">
            <Secao titulo="Identificação">
              <Grid>
                <Campo label="Aparelho" valor={os.aparelho} />
                <Campo label="Marca" valor={os.marca} />
                <Campo label="Modelo" valor={os.modelo} />
                <Campo label="Cor" valor={os.cor} />
                {os.imei && <Campo label="IMEI" valor={os.imei} />}
                <Campo label="Responsável" valor={os.responsavel} />
              </Grid>
            </Secao>

            <Secao titulo="Serviço">
              <Grid>
                <Campo label="Defeito relatado" valor={os.defeito} full />
                <Campo label="Diagnóstico" valor={os.diagnostico} full />
                <Campo label="Laudo técnico" valor={os.laudo_tecnico} full />
              </Grid>
              {itens && itens.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {itens.map((i) => (
                    <div key={i.id} className="flex items-center justify-between text-slate-700">
                      <span>
                        {i.quantidade}x {i.descricao}
                      </span>
                      <span className="font-medium">{brl(i.preco_unitario * i.quantidade)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Secao>

            <Secao titulo="Valores">
              <Grid>
                <Campo label="Valor" valor={brl(os.valor)} />
                <Campo label="Desconto" valor={brl(os.desconto)} />
                <Campo label="Valor final" valor={brl(valorFinal)} />
                <Campo
                  label="Pagamento"
                  valor={os.status_pagamento === "pago" ? "Pago" : "Pendente"}
                />
              </Grid>
            </Secao>

            {aguardandoAprovacao && (
              <Secao titulo="Aprovação do orçamento">
                <p className="mb-3 text-slate-600">
                  Este orçamento está aguardando sua decisão. Você pode aprovar para seguirmos com o
                  reparo ou reprovar caso não deseje continuar.
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setConfirmando("aprovar")}>Aprovar orçamento</Button>
                  <Button variant="outline" onClick={() => setConfirmando("reprovar")}>
                    Reprovar orçamento
                  </Button>
                </div>
              </Secao>
            )}

            <Secao titulo="Datas">
              <Grid>
                <Campo label="Entrada" valor={dataBR(os.created_at)} />
                <Campo label="Previsão" valor={dataBR(os.previsao)} />
                {(os.status === "entregue" || os.status === "faturado") && (
                  <Campo label="Conclusão" valor={dataBR(os.updated_at)} />
                )}
              </Grid>
            </Secao>

            {fotos && fotos.length > 0 && (
              <Secao titulo="Fotos">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {fotos.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                      <img
                        src={f.url}
                        alt={f.category ?? "Foto da OS"}
                        className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                      />
                    </a>
                  ))}
                </div>
              </Secao>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmando === "aprovar"}
        onOpenChange={(o) => !o && setConfirmando(null)}
        title="Aprovar orçamento?"
        description="Ao aprovar, vamos seguir com o reparo da OS."
        confirmLabel="Aprovar"
        loading={decidir.isPending}
        onConfirm={() => decidir.mutate(true)}
      />
      <ConfirmDialog
        open={confirmando === "reprovar"}
        onOpenChange={(o) => !o && setConfirmando(null)}
        title="Reprovar orçamento?"
        description="Ao reprovar, a OS não seguirá com o reparo proposto."
        confirmLabel="Reprovar"
        destructive
        loading={decidir.isPending}
        onConfirm={() => decidir.mutate(false)}
      />
    </>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{titulo}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>;
}

function Campo({ label, valor, full }: { label: string; valor: string | null; full?: boolean }) {
  if (!valor) return null;
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-800">{valor}</p>
    </div>
  );
}
