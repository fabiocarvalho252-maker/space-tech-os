import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Package,
  ShoppingCart,
  Wallet,
  LogOut,
  Menu,
  X,
  Settings,
  FileCheck,
  ShieldCheck,
  Receipt,
  Truck,
  UserCog,
  Bot,
  Wand2,
  Calendar,
  Smartphone,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrialBanner } from "@/components/TrialBanner";
import { useProfile, useCurrentUser, usePermissoes, podeVer } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard, modulo: null },
  { to: "/ordens", label: "Ordens de serviço", icon: Wrench, modulo: "ordens" },
  { to: "/pdv", label: "PDV", icon: ShoppingCart, modulo: "vendas" },
  { to: "/agenda", label: "Agenda", icon: Calendar, modulo: "agenda" },
  { to: "/vendas", label: "Vendas", icon: Receipt, modulo: "vendas" },
  { to: "/estoque", label: "Produtos", icon: Package, modulo: "produtos" },
  { to: "/servicos", label: "Serviços", icon: Wrench, modulo: "produtos" },
  { to: "/clientes", label: "Clientes", icon: Users, modulo: "clientes" },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, modulo: "fornecedores" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, modulo: "financeiro" },
  { to: "/compras", label: "Compras", icon: ShoppingCart, modulo: "compras" },
  { to: "/seminovos", label: "Compra de Seminovos", icon: Smartphone, modulo: "seminovos" },
  { to: "/cobrancas", label: "Cobranças", icon: Wallet, modulo: "cobrancas" },
  { to: "/notas", label: "Notas Fiscais", icon: FileCheck, modulo: "notas" },
  { to: "/garantia", label: "Termos de Garantia", icon: ShieldCheck, modulo: "garantia" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, modulo: "relatorios" },
  { to: "/ia-spacetech", label: "IA SPACE TECH", icon: Bot, modulo: null },
  { to: "/ferramentas", label: "Ferramentas Inteligentes", icon: Wand2, modulo: "produtos" },
  { to: "/usuarios", label: "Usuários", icon: UserCog, modulo: "configuracoes" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, modulo: "configuracoes" },
] as const;

export function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: user } = useCurrentUser();
  const { data: permissoes } = usePermissoes();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const itensVisiveis = NAV.filter((item) => !item.modulo || podeVer(permissoes, item.modulo));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {itensVisiveis.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <LogoMark className="h-10 w-10" />
          <LogoWord className="text-lg text-sidebar-accent-foreground" />
        </div>
        {nav}
        <div className="border-t border-sidebar-border p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              {profile?.loja || profile?.nome || "Minha assistência"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
          </div>
          <button
            onClick={sair}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar">
            <div className="flex items-center justify-between px-5 py-6">
              <div className="flex items-center gap-3">
                <LogoMark className="h-9 w-9" />
                <LogoWord className="text-base text-sidebar-accent-foreground" />
              </div>
              <button onClick={() => setOpen(false)} className="text-sidebar-foreground/70">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <div className="border-t border-sidebar-border p-3">
              <button
                onClick={sair}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </button>
            <LogoWord className="text-base" />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <TrialBanner />
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {action}
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
