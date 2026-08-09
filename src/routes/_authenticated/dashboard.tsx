import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import {
  Wrench,
  Package,
  Wallet,
  Users,
  TrendingUp,
  AlertTriangle,
  Search,
  ExternalLink,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  FileText,
  ShieldCheck,
  ShoppingBag,
  Layers,
  GraduationCap,
  Truck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { useProfile } from "@/hooks/useCurrentUser";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — SpaceTech" },
      { name: "description", content: "Resumo da sua assistência: OS, vendas, estoque e caixa." },
      { property: "og:title", content: "Painel — SpaceTech" },
      { property: "og:description", content: "Resumo diário da sua assistência técnica." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();

  const hojeStr = format(new Date(), "yyyy-MM-dd");
  const inicioMesStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const inicioMesISO = `${inicioMesStr}T00:00:00`;

  const { data } = useQuery({
    queryKey: ["dashboard", hojeStr],
    queryFn: async () => {
      const [os, produtos, clientes, lancamentosMes, vendas, vendaItensMes, osItensMes] =
        await Promise.all([
          supabase.from("ordens_servico").select("*").order("created_at", { ascending: false }),
          supabase.from("produtos").select("*"),
          supabase.from("clientes").select("id"),
          supabase.from("lancamentos").select("*").gte("data", inicioMesStr),
          supabase.from("vendas").select("total, created_at"),
          supabase.from("venda_itens").select("*").gte("created_at", inicioMesISO),
          supabase.from("os_itens").select("*").gte("created_at", inicioMesISO),
        ]);
      return {
        os: os.data ?? [],
        produtos: produtos.data ?? [],
        clientes: clientes.data ?? [],
        lancamentosMes: lancamentosMes.data ?? [],
        vendas: vendas.data ?? [],
        vendaItensMes: vendaItensMes.data ?? [],
        osItensMes: osItensMes.data ?? [],
      };
    },
  });

  const abertas = (data?.os ?? []).filter(
    (o) => !["entregue", "cancelada"].includes(o.status),
  ).length;

  const lancamentosHoje = (data?.lancamentosMes ?? []).filter((l) => l.data === hojeStr);
  const entradas = lancamentosHoje
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saidas = lancamentosHoje
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + Number(l.valor), 0);

  const entradasMes = (data?.lancamentosMes ?? [])
    .filter((l) => l.tipo === "entrada")
    .reduce((s, l) => s + Number(l.valor), 0);
  const saidasMes = (data?.lancamentosMes ?? [])
    .filter((l) => l.tipo === "saida")
    .reduce((s, l) => s + Number(l.valor), 0);

  const produtosById = new Map((data?.produtos ?? []).map((p) => [p.id, p]));
  let cmvMes = 0;
  for (const i of data?.osItensMes ?? []) {
    if (i.tipo === "produto" && i.produto_id) {
      cmvMes += i.quantidade * Number(produtosById.get(i.produto_id)?.preco_custo ?? 0);
    }
  }
  for (const i of data?.vendaItensMes ?? []) {
    const produto = i.produto_id ? produtosById.get(i.produto_id) : null;
    if (produto && produto.categoria !== "Serviço") {
      cmvMes += i.quantidade * Number(produto.preco_custo ?? 0);
    }
  }

  const faturamentoMes = entradasMes;
  const lucroLiquidoMes = faturamentoMes - cmvMes - saidasMes;
  const margemMes = faturamentoMes > 0 ? (lucroLiquidoMes / faturamentoMes) * 100 : 0;

  const baixoEstoque = (data?.produtos ?? []).filter((p) => p.quantidade <= p.estoque_minimo);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Olá, ${profile?.nome?.split(" ")[0] || "Administrador"}`}
        subtitle={profile?.loja ? `Painel da ${profile.loja}` : "Visão geral da sua operação"}
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/ferramentas"
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary/90"
            >
              <Search className="h-4 w-4" /> Buscar de Películas
            </Link>
            <button className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent/90">
              <Target className="h-4 w-4" /> Programa de Parceiros
            </button>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Card icon={Wrench} label="OS Abertas" value={String(abertas)} tone="primary" />
        <Card
          icon={ShoppingBag}
          label="Vendas"
          value={String(data?.vendas.length ?? 0)}
          tone="success"
        />
        <Card
          icon={Package}
          label="Estoque Baixo"
          value={String(baixoEstoque.length)}
          tone="warning"
        />
        <Card
          icon={Users}
          label="Clientes"
          value={String(data?.clientes.length ?? 0)}
          tone="accent"
        />
        <Card icon={ShieldCheck} label="Garantias" value="0" tone="ink" />
        <Card icon={FileText} label="Notas Fiscais" value="0" tone="ink" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="text-sm text-muted-foreground">Receita Hoje</p>
              <p className="mt-1 text-2xl font-extrabold">{brl(entradas)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="text-sm text-muted-foreground">Despesas Hoje</p>
              <p className="mt-1 text-2xl font-extrabold text-destructive">{brl(saidas)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <p className="text-sm text-muted-foreground">Resultado</p>
              <p className="mt-1 text-2xl font-extrabold">{brl(entradas - saidas)}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Agenda Semanal</h2>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground">
              Agenda vazia para esta semana.
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Resultado Mensal (DRE)</h2>
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="p-3 bg-secondary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                <p className={`text-lg font-bold ${lucroLiquidoMes < 0 ? "text-destructive" : ""}`}>
                  {brl(lucroLiquidoMes)}
                </p>
              </div>
              <div className="p-3 bg-secondary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className="text-lg font-bold">{margemMes.toFixed(1)}%</p>
              </div>
              <div className="p-3 bg-secondary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">CMV</p>
                <p className="text-lg font-bold">{brl(cmvMes)}</p>
              </div>
              <div className="p-3 bg-secondary/20 rounded-xl">
                <p className="text-xs text-muted-foreground">Faturamento</p>
                <p className="text-lg font-bold">{brl(faturamentoMes)}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Últimas OS</h2>
              <Link to="/ordens" className="text-sm font-semibold text-primary">
                Ver tudo
              </Link>
            </div>
            {data?.os.length ? (
              <div className="space-y-4">
                {data.os.slice(0, 5).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        #{o.numero} - {o.aparelho}
                      </p>
                      <p className="text-xs text-muted-foreground">{statusLabel(o.status)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma OS aberta.</p>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-base font-bold mb-4">Top 10 Produtos</h2>
            <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
          </section>
        </div>
      </div>

      {/* Partners Footer */}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft flex items-center gap-4">
          <Truck className="h-10 w-10 text-primary" />
          <div>
            <h3 className="font-bold">Distribuidores</h3>
            <p className="text-sm text-muted-foreground">Compre peças com parceiros homologados.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Vazio({ texto, link, acao }: { texto: string; link: string; acao: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <p>{texto}</p>
      <Link to={link} className="mt-2 inline-block font-semibold text-primary">
        {acao}
      </Link>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "primary" | "success" | "ink" | "accent" | "warning";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    ink: "bg-ink/10 text-ink",
    accent: "bg-accent text-accent-foreground",
    warning: "bg-warning/10 text-warning",
  } as const;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
