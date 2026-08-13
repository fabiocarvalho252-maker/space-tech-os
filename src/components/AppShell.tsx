import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  ChevronDown,
  CreditCard,
  Lock,
  Mail,
  ArrowLeftRight,
  MessageSquare,
  Percent,
  Bell,
  Clock,
  Calculator,
  Boxes,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrialBanner } from "@/components/TrialBanner";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SpaceTechAI } from "@/components/ai/SpaceTechAI";
import { useProfile, useCurrentUser, usePermissoes, podeVer } from "@/hooks/useCurrentUser";
import { ATALHOS, estaDigitando } from "@/lib/atalhos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ItemMenu =
  | { label: string; to: string; hash?: string; icon: React.ElementType }
  | { label: string; emBreve: true; icon: React.ElementType };

const RELATORIOS_ITENS: ItemMenu[] = [
  { label: "Clientes", to: "/relatorios", hash: "visao-geral", icon: Users },
  { label: "Produtos", to: "/relatorios", hash: "produtos", icon: Package },
  { label: "Serviços", to: "/relatorios", hash: "servicos", icon: Wrench },
  { label: "Vendas", to: "/relatorios", hash: "visao-geral", icon: ShoppingCart },
  { label: "Receitas Brutas - MEI", emBreve: true, icon: Receipt },
  { label: "Ordem de Serviço", to: "/relatorios", hash: "ordens", icon: FileCheck },
  { label: "Financeiro - DRE", to: "/relatorios", hash: "financeiro", icon: Wallet },
  { label: "Contas Bancárias", emBreve: true, icon: CreditCard },
  { label: "Meu Contador", to: "/meu-contador", icon: Calculator },
  { label: "Comissões", emBreve: true, icon: Percent },
];

const SISTEMA_ITENS: ItemMenu[] = [
  { label: "Sistema", to: "/configuracoes", icon: Settings },
  { label: "Usuários", to: "/usuarios", icon: UserCog },
  { label: "Permissões", to: "/usuarios", icon: Lock },
  { label: "Emails", to: "/configuracoes", icon: Mail },
  { label: "Migrar de Outro Sistema", emBreve: true, icon: ArrowLeftRight },
  { label: "Fila WhatsApp", emBreve: true, icon: MessageSquare },
];

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
  { to: "/aparelhos", label: "Aparelhos", icon: Boxes, modulo: "aparelhos" },
  { to: "/seminovos", label: "Compra de Seminovos", icon: Smartphone, modulo: "seminovos" },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare, modulo: "configuracoes" },
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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (estaDigitando(e.target)) return;
      const atalho = ATALHOS.find((a) => a.tecla === e.key);
      if (!atalho) return;
      e.preventDefault();
      navigate({ to: atalho.to });
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [navigate]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const nomeExibicao = profile?.nome || user?.email?.split("@")[0] || "Usuário";

  const itensVisiveis = NAV.filter((item) => !item.modulo || podeVer(permissoes, item.modulo));

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-3">
      {itensVisiveis.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors active:scale-[0.98] lg:py-2.5",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" />
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
          <div
            className="absolute inset-0 bg-foreground/40 animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[80vw] max-w-72 flex-col overflow-hidden bg-sidebar shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex shrink-0 items-center justify-between px-5 py-6">
              <div className="flex items-center gap-3">
                <LogoMark className="h-9 w-9" />
                <LogoWord className="text-base text-sidebar-accent-foreground" />
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="-mr-2 rounded-lg p-2 text-sidebar-foreground/70 active:bg-sidebar-accent/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            <div className="shrink-0 border-t border-sidebar-border p-3">
              <div className="px-2 pb-2">
                <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                  {profile?.loja || profile?.nome || "Minha assistência"}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
              </div>
              <Link
                to="/assinatura"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 active:bg-sidebar-accent/60"
              >
                <CreditCard className="h-5 w-5" /> Meu Plano
              </Link>
              <button
                onClick={sair}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-sidebar-foreground/70 active:bg-sidebar-accent/60"
              >
                <LogOut className="h-5 w-5" /> Sair
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
              className="-ml-2 rounded-lg p-2 active:bg-accent/60"
            >
              <Menu className="h-5 w-5" />
            </button>
            <LogoWord className="text-base" />
          </div>
          <ThemeToggle />
        </header>
        <header className="hidden items-center justify-between gap-3 border-b border-border bg-card/70 px-6 py-2.5 backdrop-blur lg:flex">
          <p className="text-sm font-semibold text-foreground/80">
            {saudacao()}, <span className="text-foreground">{nomeExibicao}</span>
          </p>
          <div className="flex items-center gap-2">
            <HeaderMenu label="Relatórios" icon={BarChart3} itens={RELATORIOS_ITENS} />
            <HeaderMenu
              label="Sistema"
              icon={Settings}
              itens={SISTEMA_ITENS}
              topo={{ label: "Meu Plano", to: "/assinatura", icon: CreditCard }}
            />
            <NotificacoesMenu />
            <PerfilMenu
              nome={nomeExibicao}
              {...(user?.email ? { email: user.email } : {})}
              onSair={sair}
            />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <ImpersonationBanner />
          <TrialBanner />
          <Outlet />
        </main>
      </div>

      <SpaceTechAI />
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        {action}
        <div className="hidden lg:block">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function HeaderMenu({
  label,
  icon: Icon,
  itens,
  topo,
}: {
  label: string;
  icon: React.ElementType;
  itens: ItemMenu[];
  topo?: { label: string; to: string; icon: React.ElementType };
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Icon className="h-4 w-4" /> {label} <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {topo && (
          <>
            <DropdownMenuItem asChild>
              <Link to={topo.to} className="flex items-center gap-2">
                <topo.icon className="h-4 w-4" /> {topo.label}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground">
              SISTEMA
            </DropdownMenuLabel>
          </>
        )}
        {itens.map((item) =>
          "emBreve" in item ? (
            <DropdownMenuItem
              key={item.label}
              disabled
              className="flex items-center gap-2 opacity-50"
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              <span className="text-[10px] text-muted-foreground">Em breve</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={`${item.label}-${item.hash ?? ""}`} asChild>
              <Link
                to={item.to}
                {...(item.hash ? { hash: item.hash } : {})}
                className="flex items-center gap-2"
              >
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toUpperCase();
}

type Notificacao = {
  id: string;
  titulo: string;
  descricao: string;
  to: string;
  icon: React.ElementType;
};

function useNotificacoes() {
  return useQuery({
    queryKey: ["notificacoes-header"],
    queryFn: async () => {
      const [{ data: produtos }, { count: osAguardando }] = await Promise.all([
        supabase.from("produtos").select("id, nome, quantidade, estoque_minimo"),
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .eq("status", "aguardando_aprovacao"),
      ]);

      const baixoEstoque = (produtos ?? []).filter((p) => p.quantidade <= p.estoque_minimo);

      const itens: Notificacao[] = [];
      if (baixoEstoque.length > 0) {
        itens.push({
          id: "estoque-baixo",
          titulo: `${baixoEstoque.length} produto${baixoEstoque.length > 1 ? "s" : ""} com estoque baixo`,
          descricao: baixoEstoque
            .slice(0, 3)
            .map((p) => p.nome)
            .join(", "),
          to: "/estoque",
          icon: Package,
        });
      }
      if ((osAguardando ?? 0) > 0) {
        itens.push({
          id: "os-aguardando",
          titulo: `${osAguardando} ordem${osAguardando! > 1 ? "s" : ""} aguardando aprovação`,
          descricao: "Clientes precisam aprovar o orçamento",
          to: "/ordens",
          icon: Clock,
        });
      }
      return itens;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

function NotificacoesMenu() {
  const { data: notificacoes } = useNotificacoes();
  const total = notificacoes?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {total}
            </span>
          )}
          <span className="sr-only">Notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground">
          NOTIFICAÇÕES
        </DropdownMenuLabel>
        {total === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
            <Bell className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Nenhuma notificação no momento</p>
          </div>
        ) : (
          notificacoes!.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link to={n.to} className="flex items-start gap-2.5 py-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <n.icon className="h-3.5 w-3.5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold leading-tight">{n.titulo}</span>
                  <span className="line-clamp-1 text-[11px] text-muted-foreground">
                    {n.descricao}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PerfilMenu({ nome, email, onSair }: { nome: string; email?: string; onSair: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90">
          {iniciais(nome)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{nome}</p>
          {email && <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/configuracoes" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Configurações
          </Link>
        </DropdownMenuItem>
        {email === "admin@spacetech.app" && (
          <DropdownMenuItem asChild>
            <Link to="/admin" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Administração do site
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSair} className="flex items-center gap-2 text-destructive">
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
