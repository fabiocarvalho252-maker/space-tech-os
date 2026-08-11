import { LayoutGrid, ShoppingCart, User, Wrench } from "lucide-react";

export type ClientAccountTab = "visao-geral" | "compras" | "os" | "dados";

const TABS: { id: ClientAccountTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "visao-geral", label: "Visão geral", icon: LayoutGrid },
  { id: "compras", label: "Compras e Vendas", icon: ShoppingCart },
  { id: "os", label: "Ordens de Serviço", icon: Wrench },
  { id: "dados", label: "Meus Dados", icon: User },
];

export function ClientAccountTabs({
  ativa,
  onChange,
}: {
  ativa: ClientAccountTab;
  onChange: (tab: ClientAccountTab) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max min-w-full gap-2 border-b border-slate-200 pb-px sm:w-full">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const ativo = tab.id === ativa;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                ativo
                  ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
