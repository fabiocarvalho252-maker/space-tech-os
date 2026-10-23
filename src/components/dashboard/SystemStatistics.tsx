import type { LucideIcon } from "lucide-react";
import { ClipboardList, Package, ShieldCheck, ShoppingBag, Users, Wrench } from "lucide-react";

type Metrica = { label: string; valor: number; icon: LucideIcon; cor: string };

export function SystemStatistics({
  clientes,
  produtos,
  servicos,
  ordens,
  garantias,
  vendas,
}: {
  clientes: number;
  produtos: number;
  servicos: number;
  ordens: number;
  garantias: number;
  vendas: number;
}) {
  const metricas: Metrica[] = [
    { label: "Clientes", valor: clientes, icon: Users, cor: "text-indigo-600 bg-indigo-500/10" },
    { label: "Produtos", valor: produtos, icon: Package, cor: "text-amber-600 bg-amber-500/10" },
    { label: "Serviços", valor: servicos, icon: Wrench, cor: "text-cyan-600 bg-cyan-500/10" },
    { label: "Ordens", valor: ordens, icon: ClipboardList, cor: "text-rose-600 bg-rose-500/10" },
    {
      label: "Garantias",
      valor: garantias,
      icon: ShieldCheck,
      cor: "text-emerald-600 bg-emerald-500/10",
    },
    { label: "Vendas", valor: vendas, icon: ShoppingBag, cor: "text-purple-600 bg-purple-500/10" },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-soft sm:p-5">
      <h2 className="mb-2 text-sm font-bold sm:mb-4 sm:text-base">Estatísticas</h2>
      {/* Celular: 3 por linha (2 linhas); na lateral do desktop, 2 por linha. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-2">
        {metricas.map((m) => (
          <StatisticCard key={m.label} {...m} />
        ))}
      </div>
    </section>
  );
}

function StatisticCard({ label, valor, icon: Icon, cor }: Metrica) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-2 sm:rounded-xl sm:p-3">
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md sm:h-9 sm:w-9 sm:rounded-lg ${cor}`}
      >
        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
      </span>
      <p className="mt-1 text-base font-extrabold leading-tight tracking-tight sm:mt-2 sm:text-xl">
        {valor}
      </p>
      <p className="text-[11px] text-muted-foreground sm:text-xs">{label}</p>
    </div>
  );
}
