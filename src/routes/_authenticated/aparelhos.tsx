// Módulo "Aparelhos" (pedido): estoque próprio de celulares lacrados e
// seminovos para venda, rastreado por unidade/IMEI. Mesma receita de
// seminovos.tsx/compras.tsx (createFileRoute + TanStack Query + tabela
// crua + Dialogs do shadcn) — as partes pesadas (cadastro, venda, detalhe)
// ficam em componentes próprios sob src/components/aparelhos/.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Boxes,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { dataBR, statusLabel } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { SearchInput } from "@/components/SearchInput";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listarAparelhosComCustoFn } from "@/lib/aparelhos/aparelhos.functions";
import { CadastroAparelhoModal } from "@/components/aparelhos/CadastroAparelhoModal";
import { VenderAparelhoModal } from "@/components/aparelhos/VenderAparelhoModal";
import { DetalheAparelhoModal } from "@/components/aparelhos/DetalheAparelhoModal";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/aparelhos")({
  head: () => ({
    meta: [
      { title: "Aparelhos — SpaceTech" },
      {
        name: "description",
        content: "Estoque, venda e garantia de aparelhos lacrados e seminovos.",
      },
    ],
  }),
  component: Aparelhos,
});

type AparelhoRow = Database["public"]["Tables"]["aparelhos"]["Row"];
type Aba = "todos" | "lacrados" | "seminovos" | "vendidos" | "garantias";

// Referência estável — usar `data?.aparelhos ?? []` inline criaria um array
// novo a cada render, invalidando a memoização dos hooks que dependem dele.
const APARELHOS_VAZIO: AparelhoRow[] = [];

const TONE_POR_STATUS: Record<string, StatusTone> = {
  disponivel: "success",
  reservado: "warning",
  vendido: "info",
  devolvido: "danger",
  garantia: "purple",
  cancelado: "neutral",
};

function CardEstatistica({
  icon: Icon,
  cor,
  label,
  valor,
}: {
  icon: typeof Boxes;
  cor: string;
  label: string;
  valor: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${cor}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-xl font-extrabold tracking-tight">{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Aparelhos() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "aparelhos");

  const [aba, setAba] = useState<Aba>("todos");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [modalCadastro, setModalCadastro] = useState(false);
  const [aparelhoEmEdicao, setAparelhoEmEdicao] = useState<AparelhoRow | null>(null);
  const [modalVenda, setModalVenda] = useState(false);
  const [aparelhoParaVender, setAparelhoParaVender] = useState<AparelhoRow | null>(null);
  const [modalDetalhe, setModalDetalhe] = useState(false);
  const [aparelhoDetalhe, setAparelhoDetalhe] = useState<AparelhoRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aparelhos"],
    queryFn: () => listarAparelhosComCustoFn(),
  });
  const aparelhos = data?.aparelhos ?? APARELHOS_VAZIO;
  const podeVerCusto = data?.podeVerCusto ?? false;

  const { data: garantias = [], isLoading: carregandoGarantias } = useQuery({
    queryKey: ["aparelho-garantias-lista"],
    enabled: aba === "garantias",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aparelho_garantias")
        .select("*, aparelhos(marca, modelo, imei1), clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (Database["public"]["Tables"]["aparelho_garantias"]["Row"] & {
        aparelhos: { marca: string; modelo: string; imei1: string | null } | null;
        clientes: { nome: string } | null;
      })[];
    },
  });

  const listaFiltrada = useMemo(() => {
    let lista = aparelhos;
    if (aba === "lacrados") lista = lista.filter((a) => a.tipo === "lacrado");
    else if (aba === "seminovos") lista = lista.filter((a) => a.tipo === "seminovo");
    else if (aba === "vendidos") lista = lista.filter((a) => a.status === "vendido");

    if (filtroStatus !== "todos") lista = lista.filter((a) => a.status === filtroStatus);

    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((a) =>
        [a.marca, a.modelo, a.imei1, a.imei2, a.numero_serie]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(termo)),
      );
    }
    return lista;
  }, [aparelhos, aba, filtroStatus, busca]);

  const estatisticas = useMemo(() => {
    const emEstoque = aparelhos.filter(
      (a) => a.status === "disponivel" || a.status === "reservado",
    );
    const investido = emEstoque.reduce((s, a) => s + Number(a.preco_custo ?? 0), 0);
    const valorVenda = emEstoque.reduce((s, a) => s + Number(a.preco_venda ?? 0), 0);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const vendidosNoMes = aparelhos.filter(
      (a) => a.status === "vendido" && a.sold_at && new Date(a.sold_at) >= inicioMes,
    );
    const vendasDoMes = vendidosNoMes.reduce((s, a) => s + Number(a.preco_venda ?? 0), 0);
    const lucroRealizado = vendidosNoMes.reduce(
      (s, a) => s + (Number(a.preco_venda ?? 0) - Number(a.preco_custo ?? 0)),
      0,
    );
    return {
      estoque: emEstoque.length,
      lacrados: emEstoque.filter((a) => a.tipo === "lacrado").length,
      seminovos: emEstoque.filter((a) => a.tipo === "seminovo").length,
      investido,
      valorVenda,
      lucroPotencial: valorVenda - investido,
      vendasDoMes,
      lucroRealizado,
    };
  }, [aparelhos]);

  return (
    <div>
      <PageHeader
        title="Aparelhos"
        subtitle="Estoque, venda e garantia de aparelhos lacrados e seminovos."
        action={
          gerenciar && (
            <Button
              onClick={() => {
                setAparelhoEmEdicao(null);
                setModalCadastro(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo aparelho
            </Button>
          )
        }
      />

      <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 text-base font-bold">Painel</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CardEstatistica
            icon={Boxes}
            cor="text-indigo-600 bg-indigo-500/10"
            label="Em estoque"
            valor={String(estatisticas.estoque)}
          />
          <CardEstatistica
            icon={Package}
            cor="text-amber-600 bg-amber-500/10"
            label={`Lacrados / Seminovos`}
            valor={`${estatisticas.lacrados} / ${estatisticas.seminovos}`}
          />
          {podeVerCusto && (
            <CardEstatistica
              icon={Wallet}
              cor="text-rose-600 bg-rose-500/10"
              label="Investido em estoque"
              valor={brl(estatisticas.investido)}
            />
          )}
          <CardEstatistica
            icon={TrendingUp}
            cor="text-cyan-600 bg-cyan-500/10"
            label="Valor de venda em estoque"
            valor={brl(estatisticas.valorVenda)}
          />
          {podeVerCusto && (
            <CardEstatistica
              icon={TrendingUp}
              cor="text-emerald-600 bg-emerald-500/10"
              label="Lucro potencial"
              valor={brl(estatisticas.lucroPotencial)}
            />
          )}
          <CardEstatistica
            icon={Smartphone}
            cor="text-purple-600 bg-purple-500/10"
            label="Vendas do mês"
            valor={brl(estatisticas.vendasDoMes)}
          />
          {podeVerCusto && (
            <CardEstatistica
              icon={Wallet}
              cor="text-emerald-600 bg-emerald-500/10"
              label="Lucro realizado no mês"
              valor={brl(estatisticas.lucroRealizado)}
            />
          )}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-border">
        {(
          [
            ["todos", "Todos"],
            ["lacrados", "Lacrados"],
            ["seminovos", "Seminovos"],
            ["vendidos", "Vendidos"],
            ["garantias", "Garantias"],
          ] as [Aba, string][]
        ).map(([valor, label]) => (
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

      {aba === "garantias" ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          {carregandoGarantias ? (
            <TableSkeleton />
          ) : garantias.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Nº</th>
                    <th className="px-3 py-2">Aparelho</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Início</th>
                    <th className="px-3 py-2">Fim</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {garantias.map((g) => (
                    <tr key={g.id} className="border-b border-border/60">
                      <td className="px-3 py-3">GAR-{String(g.numero).padStart(6, "0")}</td>
                      <td className="px-3 py-3">
                        {g.aparelhos?.marca} {g.aparelhos?.modelo}
                      </td>
                      <td className="px-3 py-3">{g.clientes?.nome ?? "—"}</td>
                      <td className="px-3 py-3">{dataBR(g.inicio)}</td>
                      <td className="px-3 py-3">{dataBR(g.fim)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          label={
                            {
                              ativa: "Ativa",
                              expirada: "Expirada",
                              cancelada: "Cancelada",
                              acionada: "Acionada",
                            }[g.status] ?? g.status
                          }
                          tone={
                            g.status === "ativa"
                              ? "success"
                              : g.status === "acionada"
                                ? "warning"
                                : g.status === "cancelada"
                                  ? "danger"
                                  : "neutral"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={ShieldCheck} title="Nenhuma garantia emitida ainda" />
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap gap-3">
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por marca, modelo, IMEI ou série..."
              className="min-w-64 flex-1"
            />
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="reservado">Reservado</SelectItem>
                <SelectItem value="vendido">Vendido</SelectItem>
                <SelectItem value="devolvido">Devolvido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : listaFiltrada.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Nº</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Marca / Modelo</th>
                    <th className="px-3 py-2">Armaz.</th>
                    <th className="px-3 py-2">Cor</th>
                    <th className="px-3 py-2">IMEI</th>
                    {podeVerCusto && <th className="px-3 py-2">Custo</th>}
                    <th className="px-3 py-2">Venda</th>
                    {podeVerCusto && <th className="px-3 py-2">Lucro</th>}
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map((a) => {
                    const lucro = Number(a.preco_venda) - Number(a.preco_custo);
                    return (
                      <tr
                        key={a.id}
                        className="cursor-pointer border-b border-border/60 hover:bg-secondary/30"
                        onClick={() => {
                          setAparelhoDetalhe(a);
                          setModalDetalhe(true);
                        }}
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          AP-{String(a.numero).padStart(6, "0")}
                        </td>
                        <td className="px-3 py-3">
                          {a.tipo === "lacrado" ? "Lacrado" : "Seminovo"}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {a.marca} {a.modelo}
                        </td>
                        <td className="px-3 py-3">{a.armazenamento ?? "—"}</td>
                        <td className="px-3 py-3">{a.cor ?? "—"}</td>
                        <td className="px-3 py-3">{a.imei1 ?? "—"}</td>
                        {podeVerCusto && <td className="px-3 py-3">{brl(a.preco_custo)}</td>}
                        <td className="px-3 py-3">{brl(a.preco_venda)}</td>
                        {podeVerCusto && (
                          <td
                            className={`px-3 py-3 ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}
                          >
                            {brl(lucro)}
                          </td>
                        )}
                        <td className="px-3 py-3">
                          <StatusBadge
                            label={statusLabel(a.status)}
                            tone={TONE_POR_STATUS[a.status] ?? "neutral"}
                          />
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{dataBR(a.created_at)}</td>
                        <td className="px-3 py-3 text-right">
                          {gerenciar && a.status === "disponivel" && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAparelhoParaVender(a);
                                setModalVenda(true);
                              }}
                            >
                              Vender
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="Nenhum aparelho encontrado"
              description="Ajuste a busca ou os filtros, ou cadastre um novo aparelho."
            />
          )}
        </section>
      )}

      {empresaId && (
        <>
          <CadastroAparelhoModal
            open={modalCadastro}
            onOpenChange={setModalCadastro}
            aparelho={aparelhoEmEdicao}
            empresaId={empresaId}
            podeVerCusto={podeVerCusto}
          />
          <VenderAparelhoModal
            open={modalVenda}
            onOpenChange={setModalVenda}
            aparelho={aparelhoParaVender}
            empresaId={empresaId}
          />
          <DetalheAparelhoModal
            open={modalDetalhe}
            onOpenChange={setModalDetalhe}
            aparelho={aparelhoDetalhe}
            empresaId={empresaId}
            podeVerCusto={podeVerCusto}
            podeGerenciarModulo={gerenciar}
            onEditar={() => {
              setModalDetalhe(false);
              setAparelhoEmEdicao(aparelhoDetalhe);
              setModalCadastro(true);
            }}
            onVender={() => {
              setModalDetalhe(false);
              setAparelhoParaVender(aparelhoDetalhe);
              setModalVenda(true);
            }}
          />
        </>
      )}
    </div>
  );
}
