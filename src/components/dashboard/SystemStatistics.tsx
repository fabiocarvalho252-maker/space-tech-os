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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-4 text-base font-bold">Estatísticas</h2>
      <div className="grid grid-cols-2 gap-3">
        {metricas.map((m) => (
          <StatisticCard key={m.label} {...m} />
        ))}
      </div>
    </section>
  );
}

function StatisticCard({ label, valor, icon: Icon, cor }: Metrica) {
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
