import {
  BadgeCheck,
  Boxes,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

// Ilustração do painel feita em HTML/CSS (não há screenshot real no
// projeto; o admin pode trocar por uma foto em /admin/landing). Os números
// são ilustrativos — o bloco inteiro é uma imagem para leitores de tela.
const MENU = [
  { icon: LayoutDashboard, label: "Dashboard", ativo: true },
  { icon: Users, label: "Clientes" },
  { icon: Package, label: "Produtos" },
  { icon: Wrench, label: "Serviços" },
  { icon: ShoppingBag, label: "Vendas" },
  { icon: ShoppingCart, label: "PDV" },
  { icon: Boxes, label: "Compras" },
  { icon: FileText, label: "OS" },
  { icon: Receipt, label: "NF" },
  { icon: Smartphone, label: "Seminovos" },
  { icon: ShieldCheck, label: "Garantias" },
  { icon: Wallet, label: "Financeiro" },
];

const CARDS = [
  { label: "Faturamento do mês", valor: "R$ 18.420", variacao: "+12%" },
  { label: "Ordens de serviço", valor: "32 abertas", variacao: "8 prontas" },
  { label: "Vendas hoje", valor: "R$ 1.260", variacao: "14 vendas" },
  { label: "Estoque", valor: "412 itens", variacao: "3 abaixo do mín." },
];

const BARRAS = [38, 52, 44, 61, 58, 72, 66, 80, 74, 88, 82, 95];

const OS_RECENTES = [
  { n: "#1042", aparelho: "iPhone 13 — Troca de tela", status: "Em reparo", cor: "bg-amber-400" },
  { n: "#1041", aparelho: "Galaxy A54 — Bateria", status: "Pronta", cor: "bg-emerald-400" },
  { n: "#1040", aparelho: "Moto G84 — Conector", status: "Orçamento", cor: "bg-violet-400" },
];

export function DashboardMockup() {
  return (
    <div
      role="img"
      aria-label="Ilustração do painel do SPACE TECH OS com faturamento, ordens de serviço, vendas, estoque e gráfico mensal"
      className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-violet-950/50 backdrop-blur sm:rounded-3xl"
    >
      {/* barra do navegador */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-zinc-950/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="mx-auto hidden truncate rounded-md bg-white/5 px-3 py-1 text-[11px] text-zinc-400 sm:block">
          srmpretech.online/dashboard
        </span>
      </div>

      <div className="flex">
        <aside className="hidden w-44 shrink-0 border-r border-white/10 bg-zinc-950/40 p-3 md:block">
          <ul className="space-y-0.5">
            {MENU.map((m) => (
              <li
                key={m.label}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] ${
                  m.ativo ? "bg-violet-600/20 font-semibold text-violet-200" : "text-zinc-400"
                }`}
              >
                <m.icon className="h-3.5 w-3.5 shrink-0" />
                {m.label}
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 space-y-3 p-3 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-zinc-500">Bom dia 👋</p>
              <p className="text-sm font-bold text-white sm:text-base">Resumo da assistência</p>
            </div>
            <span className="rounded-full bg-violet-600/20 px-2.5 py-1 text-[10px] font-semibold text-violet-200">
              Hoje
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {CARDS.map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-white/5 bg-white/[0.04] p-2.5 sm:p-3"
              >
                <p className="truncate text-[10px] text-zinc-500 sm:text-[11px]">{c.label}</p>
                <p className="mt-1 truncate text-sm font-bold text-white sm:text-base">{c.valor}</p>
                <p className="mt-0.5 truncate text-[10px] text-violet-300">{c.variacao}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-white/5 bg-white/[0.04] p-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-zinc-300">
                  Faturamento — últimos 12 meses
                </p>
                <BadgeCheck className="h-3.5 w-3.5 text-violet-300" />
              </div>
              <div className="mt-3 flex h-24 items-end gap-1 sm:h-32 sm:gap-1.5">
                {BARRAS.map((h, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-violet-700 to-violet-400"
                    style={{ height: `${h}%`, opacity: 0.45 + (i / BARRAS.length) * 0.55 }}
                  />
                ))}
              </div>
            </div>
            <div className="hidden rounded-xl border border-white/5 bg-white/[0.04] p-3 sm:block lg:col-span-2">
              <p className="text-[11px] font-semibold text-zinc-300">Ordens de serviço recentes</p>
              <ul className="mt-2 space-y-2">
                {OS_RECENTES.map((o) => (
                  <li key={o.n} className="flex items-center gap-2 text-[11px]">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${o.cor}`} />
                    <span className="font-semibold text-zinc-300">{o.n}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-500">{o.aparelho}</span>
                    <span className="shrink-0 text-zinc-400">{o.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
