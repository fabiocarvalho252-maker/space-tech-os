// Módulo "Crediário": venda de aparelho parcelada com bloqueio remoto em
// caso de atraso. Lista os contratos com resumo da carteira; criação e
// detalhe ficam em src/components/crediario/. Ao abrir, roda a rotina de
// inadimplência da empresa (a mesma que o pg_cron roda de hora em hora),
// para a tela nunca mostrar um atraso ainda não processado.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, HandCoins, Lock, Plus, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { dataBR } from "@/lib/format";
import { numeroContrato, statusAparelho, statusContrato } from "@/lib/crediario";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { NovoContratoModal } from "@/components/crediario/NovoContratoModal";
import { DetalheContratoModal } from "@/components/crediario/DetalheContratoModal";

export const Route = createFileRoute("/_authenticated/crediario")({
  head: () => ({
    meta: [
      { title: "Crediário — SpaceTech" },
      {
        name: "description",
        content: "Venda de aparelhos parcelada com bloqueio automático em caso de atraso.",
      },
    ],
  }),
  component: Crediario,
});

type Aba = "abertos" | "atrasados" | "bloqueados" | "encerrados" | "todos";

const ABAS: [Aba, string][] = [
  ["abertos", "Em andamento"],
  ["atrasados", "Atrasados"],
  ["bloqueados", "Bloqueados"],
  ["encerrados", "Encerrados"],
  ["todos", "Todos"],
];

function Crediario() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "crediario");

  const [aba, setAba] = useState<Aba>("abertos");
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  // Processa atrasos da empresa antes de listar; falha aqui (ex.: sem
  // permissão) não impede a listagem.
  const { isFetched: processado } = useQuery({
    queryKey: ["crediario", "processar", empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      await supabase.rpc("processar_inadimplencia_crediario", { p_empresa_id: empresaId! });
      return true;
    },
  });

  useEffect(() => {
    if (processado) qc.invalidateQueries({ queryKey: ["crediario", "contratos"] });
  }, [processado, qc]);

  const {
    data: contratos = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["crediario", "contratos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_crediario_contratos")
        .select("*")
        .eq("user_id", empresaId!)
        .order("numero", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resumo = useMemo(() => {
    const abertos = contratos.filter((c) => c.status !== "quitado" && c.status !== "cancelado");
    return {
      abertos: abertos.length,
      atrasados: contratos.filter((c) => c.status === "atrasado" || c.status === "bloqueado")
        .length,
      bloqueados: contratos.filter((c) => c.status_aparelho === "bloqueado").length,
      aReceber: abertos.reduce((s, c) => s + Number(c.saldo_devedor ?? 0), 0),
    };
  }, [contratos]);

  const lista = useMemo(() => {
    let l = contratos;
    if (aba === "abertos") l = l.filter((c) => c.status !== "quitado" && c.status !== "cancelado");
    else if (aba === "atrasados")
      l = l.filter((c) => c.status === "atrasado" || c.status === "bloqueado");
    else if (aba === "bloqueados") l = l.filter((c) => c.status_aparelho === "bloqueado");
    else if (aba === "encerrados")
      l = l.filter((c) => c.status === "quitado" || c.status === "cancelado");

    const termo = busca.trim().toLowerCase();
    if (termo) {
      l = l.filter((c) =>
        [numeroContrato(c.numero), c.cliente_nome, c.imei, c.marca, c.modelo]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo)),
      );
    }
    return l;
  }, [contratos, aba, busca]);

  return (
    <div>
      <PageHeader
        title="Crediário"
        subtitle="Venda parcelada de aparelhos com bloqueio automático em caso de atraso."
        action={
          gerenciar && (
            <Button onClick={() => setNovoAberto(true)}>
              <Plus className="h-4 w-4" /> Novo contrato
            </Button>
          )
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          icon={HandCoins}
          cor="text-indigo-600 bg-indigo-500/10"
          label="Contratos em andamento"
          valor={String(resumo.abertos)}
        />
        <Card
          icon={AlertTriangle}
          cor="text-amber-600 bg-amber-500/10"
          label="Em atraso"
          valor={String(resumo.atrasados)}
        />
        <Card
          icon={Lock}
          cor="text-rose-600 bg-rose-500/10"
          label="Aparelhos bloqueados"
          valor={String(resumo.bloqueados)}
        />
        <Card
          icon={Wallet}
          cor="text-emerald-600 bg-emerald-500/10"
          label="Saldo a receber"
          valor={brl(resumo.aReceber)}
        />
      </section>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap gap-2">
          {ABAS.map(([valor, label]) => (
            <button
              key={valor}
              onClick={() => setAba(valor)}
              className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${
                aba === valor
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchInput
          value={busca}
          onChange={setBusca}
          placeholder="Contrato, cliente ou IMEI"
          className="mb-2 w-full sm:w-72"
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        {error ? (
          <ErrorState message="Não foi possível carregar os contratos." onRetry={() => refetch()} />
        ) : isLoading ? (
          <TableSkeleton />
        ) : !lista.length ? (
          <EmptyState
            icon={HandCoins}
            title={contratos.length ? "Nenhum contrato nesta aba" : "Nenhum contrato ainda"}
            {...(contratos.length
              ? {}
              : {
                  description: "Venda um aparelho parcelado com proteção contra inadimplência.",
                  ...(gerenciar
                    ? { actionLabel: "Novo contrato", onAction: () => setNovoAberto(true) }
                    : {}),
                })}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Contrato</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Aparelho</th>
                  <th className="px-3 py-2">Parcelas</th>
                  <th className="px-3 py-2">Próx. vencimento</th>
                  <th className="px-3 py-2">Saldo</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const st = statusContrato(c.status);
                  const ap = statusAparelho(c.status_aparelho);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetalheId(c.id)}
                      className="cursor-pointer border-b border-border/60 transition hover:bg-secondary/30"
                    >
                      <td className="px-3 py-3 font-semibold">{numeroContrato(c.numero)}</td>
                      <td className="px-3 py-3">{c.cliente_nome ?? "—"}</td>
                      <td className="px-3 py-3">
                        {c.marca} {c.modelo}
                        <span className="block font-mono text-xs text-muted-foreground">
                          {c.imei}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {c.parcelas_pagas ?? 0}/{c.num_parcelas}
                      </td>
                      <td className="px-3 py-3">{dataBR(c.proximo_vencimento)}</td>
                      <td className="px-3 py-3">{brl(c.saldo_devedor)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge
                            label={c.dias_atraso ? `${st.label} · ${c.dias_atraso}d` : st.label}
                            tone={st.tone}
                          />
                          {c.status_aparelho === "bloqueado" && (
                            <StatusBadge label={ap.label} tone={ap.tone} icon={Lock} />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {empresaId && (
        <>
          <NovoContratoModal
            open={novoAberto}
            onOpenChange={setNovoAberto}
            empresaId={empresaId}
            onCriado={setDetalheId}
          />
          <DetalheContratoModal
            contratoId={detalheId}
            onOpenChange={(v) => !v && setDetalheId(null)}
            empresaId={empresaId}
            gerenciar={gerenciar}
          />
        </>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  cor,
  label,
  valor,
}: {
  icon: typeof Wallet;
  cor: string;
  label: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${cor}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
