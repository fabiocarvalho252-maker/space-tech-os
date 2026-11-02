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
  ChevronLeft,
  CreditCard,
  History,
  Lock,
  Mail,
  ArrowLeftRight,
  MessageSquare,
  Percent,
  Bell,
  Clock,
  Boxes,
  Gift,
  HandCoins,
  MonitorDown,
  MessageSquareWarning,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FinancialVisibilityToggle } from "@/components/FinancialVisibilityToggle";
import { TrialBanner } from "@/components/TrialBanner";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SpaceTechAI } from "@/components/ai/SpaceTechAI";
import { SuporteWhatsapp } from "@/components/SuporteWhatsapp";
import { InstalarAppMobile } from "@/components/InstalarAppMobile";
import { useProfile, useCurrentUser, usePermissoes, podeVer } from "@/hooks/useCurrentUser";
import { ATALHOS, estaDigitando, teclasDaTela } from "@/lib/atalhos";
import { APP_DESKTOP_WINDOWS_URL } from "@/lib/download-app";
import { cn } from "@/lib/utils";
import { listarPedidosPlanoPendentesFn } from "@/lib/site-admin.functions";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin";
import {
  listarReclamacoesPesquisaFn,
  processarNotificacoesAgendadasWhatsAppFn,
} from "@/lib/whatsapp/whatsapp.functions";
import { naoLidasCentralFn } from "@/lib/whatsapp/central.functions";
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
  { label: "Receitas Brutas - MEI", to: "/relatorio-mei", icon: Receipt },
  { label: "Ordem de Serviço", to: "/relatorios", hash: "ordens", icon: FileCheck },
  { label: "Financeiro - DRE", to: "/relatorios", hash: "financeiro", icon: Wallet },
  { label: "Contas Bancárias", to: "/contas-bancarias", icon: CreditCard },
  { label: "Comissões", to: "/relatorios", hash: "tecnicos", icon: Percent },
];

const SISTEMA_ITENS: ItemMenu[] = [
  { label: "Sistema", to: "/configuracoes", icon: Settings },
  { label: "Usuários", to: "/usuarios", icon: UserCog },
  { label: "Permissões", to: "/usuarios", icon: Lock },
  { label: "Auditoria", to: "/auditoria", icon: History },
  { label: "Emails", to: "/configuracoes", icon: Mail },
  { label: "Migrar de Outro Sistema", to: "/importar", icon: ArrowLeftRight },
  { label: "Conexão WhatsApp", to: "/whatsapp-conexao", icon: MessageSquare },
  { label: "Fila WhatsApp", to: "/whatsapp-fila", icon: MessageSquare },
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
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare, modulo: "whatsapp" },
  { to: "/cobrancas", label: "Cobranças", icon: Wallet, modulo: "cobrancas" },
  { to: "/crediario", label: "Crediário", icon: HandCoins, modulo: "crediario" },
  { to: "/garantia", label: "Termos de Garantia", icon: ShieldCheck, modulo: "garantia" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, modulo: "relatorios" },
  { to: "/ia-spacetech", label: "IA SPACE TECH", icon: Bot, modulo: null },
  { to: "/ferramentas", label: "Ferramentas Inteligentes", icon: Wand2, modulo: "produtos" },
  { to: "/indicacoes", label: "Programa de Indicações", icon: Gift, modulo: null },
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

  // Mensagens automáticas e agendadas do WhatsApp (OS pronta fica de fora:
  // sai na hora da troca de status). Não há cron no servidor, então quem
  // estiver com o sistema aberto, em qualquer tela, dispara a rodada a cada
  // 10 minutos; o servidor não repete mensagem já enviada.
  useQuery({
    queryKey: ["whatsapp-automacoes"],
    queryFn: async () => {
      const resultado = await processarNotificacoesAgendadasWhatsAppFn();
      if (resultado.processadas > 0) {
        queryClient.invalidateQueries({ queryKey: ["os-historico"] });
      }
      return resultado;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    refetchIntervalInBackground: true,
    retry: false,
  });

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
      // A tela aberta (ex.: PDV) pode ter assumido esta tecla para si.
      if (teclasDaTela.has(e.key)) return;
      const atalho = ATALHOS.find((a) => a.tecla === e.key);
      if (!atalho) return;
      // Fora de um campo de digitação, assumimos a tecla F para o atalho —
      // inclusive F1/F3/F5 etc., que o navegador reservaria (ajuda, busca,
      // recarregar). preventDefault + stopImmediatePropagation na fase de
      // captura impede que o navegador/host aja antes da navegação.
      if (estaDigitando(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      navigate({ to: atalho.to });
    }
    // Captura: roda antes de outros listeners e do comportamento padrão.
    window.addEventListener("keydown", aoTeclar, { capture: true });
    return () => window.removeEventListener("keydown", aoTeclar, { capture: true });
  }, [navigate]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const nomeExibicao = profile?.nome || user?.email?.split("@")[0] || "Usuário";

  const itensVisiveis = NAV.filter((item) => !item.modulo || podeVer(permissoes, item.modulo));

  // Conversas com mensagem nova, sem dono ou do próprio atendente.
  const { data: whatsappNaoLidas } = useQuery({
    queryKey: ["whatsapp-central", "nao-lidas"],
    queryFn: () => naoLidasCentralFn(),
    enabled: !!user && podeVer(permissoes, "whatsapp"),
    refetchInterval: 20_000,
    retry: false,
  });

  // Bolinhas laranjas de pendência: mesmos dados do sino de notificações.
  const { data: notificacoes } = useNotificacoes();
  const pendencias = new Set<string>();
  for (const n of notificacoes ?? []) {
    if (n.id === "os-aguardando") pendencias.add("/ordens");
    if (n.id === "estoque-baixo") pendencias.add("/estoque");
  }

  const [recolhida, setRecolhida] = useState(false);
  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem("sidebar-recolhida") === "1");
    } catch {
      /* sem storage: começa aberta */
    }
  }, []);
  function alternarSidebar() {
    setRecolhida((v) => {
      try {
        localStorage.setItem("sidebar-recolhida", v ? "0" : "1");
      } catch {
        /* ignora */
      }
      return !v;
    });
  }

  const ativo = (to: string) => pathname === to || pathname.startsWith(`${to}/`);
  const itemAtivo = itensVisiveis.find((i) => ativo(i.to));
  const tituloPagina = itemAtivo?.label ?? "SPACE TECH";

  // Barra horizontal do celular: mantém o item ativo à vista.
  useEffect(() => {
    document
      .querySelector('[data-barra-mobile] [data-ativo="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [pathname]);

  const bolinha = (to: string) =>
    pendencias.has(to) ? (
      <span
        className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)] ring-2 ring-[#120a24]"
        aria-label="Pendências"
      />
    ) : null;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2 [scrollbar-width:thin]">
      {itensVisiveis.map((item) => {
        const active = ativo(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            title={recolhida ? item.label : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
              active
                ? "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/60 text-white shadow-[0_4px_20px_-4px_rgba(139,92,246,0.7)]"
                : "text-white/65 hover:bg-white/10 hover:text-white",
            )}
          >
            <span className="relative shrink-0">
              <item.icon className="h-[18px] w-[18px]" />
              {bolinha(item.to)}
            </span>
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300",
                recolhida ? "pointer-events-none w-0 opacity-0" : "opacity-100",
              )}
            >
              {item.label}
            </span>
            {item.to === "/whatsapp" && !!whatsappNaoLidas && (
              <span
                className={cn(
                  "rounded-full bg-violet-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-black",
                  recolhida ? "absolute right-1 top-1" : "ml-auto",
                )}
                aria-label={`${whatsappNaoLidas} conversas não lidas`}
              >
                {whatsappNaoLidas > 99 ? "99+" : whatsappNaoLidas}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const vidro =
    "border border-white/10 bg-gradient-to-b from-[#1a0f33]/80 via-[#0d0820]/80 to-black/80 shadow-[0_20px_60px_-15px_rgba(88,28,135,0.6)] backdrop-blur-xl";

  return (
    <div className="relative min-h-screen bg-background">
      {/* brilho roxo atrás do vidro */}
      <div className="pointer-events-none fixed -left-32 top-1/4 hidden h-96 w-96 rounded-full bg-violet-600/25 blur-3xl lg:block" />

      <aside
        className={cn(
          "fixed bottom-3 left-3 top-3 z-30 hidden flex-col rounded-3xl text-white transition-[width] duration-300 ease-out lg:flex",
          vidro,
          recolhida ? "w-[76px]" : "w-64",
        )}
      >
        <button
          onClick={alternarSidebar}
          aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          className="absolute -right-3.5 top-9 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-violet-900 shadow-lg shadow-violet-900/50 transition-transform hover:scale-110"
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform duration-300", recolhida && "rotate-180")}
          />
        </button>
        <div className="flex items-center gap-3 overflow-hidden px-[18px] py-6">
          <LogoMark className="h-10 w-10 shrink-0" />
          <LogoWord
            className={cn(
              "whitespace-nowrap text-lg text-white transition-opacity duration-300",
              recolhida && "opacity-0",
            )}
          />
        </div>
        {nav}
        <div className="border-t border-white/10 p-3">
          {!recolhida && (
            <div className="px-2 pb-2">
              <p className="truncate text-sm font-semibold text-white">
                {profile?.loja || profile?.nome || "Minha assistência"}
              </p>
              <p className="truncate text-xs text-white/50">{user?.email}</p>
            </div>
          )}
          <a
            href={APP_DESKTOP_WINDOWS_URL}
            title={recolhida ? "Baixar app (Windows)" : undefined}
            className="flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <MonitorDown className="h-[18px] w-[18px] shrink-0" />
            {!recolhida && "Baixar app (Windows)"}
          </a>
          <button
            onClick={sair}
            title={recolhida ? "Sair" : undefined}
            className="flex w-full items-center gap-3 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!recolhida && "Sair"}
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute right-3 top-3 w-64 rounded-2xl p-3 text-white animate-in fade-in slide-in-from-top-2 duration-200",
              vidro,
            )}
          >
            <div className="flex items-start justify-between px-2 pb-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {profile?.loja || profile?.nome || "Minha assistência"}
                </p>
                <p className="truncate text-xs text-white/50">{user?.email}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="-mr-1 rounded-lg p-1 text-white/70 active:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Mesma conta única do PerfilMenu (o painel /admin ainda checa no servidor). */}
            {user?.email === SITE_ADMIN_EMAIL && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="mb-1 flex w-full items-center gap-3 rounded-xl bg-violet-500/20 px-3 py-3 text-sm font-semibold active:bg-violet-500/30"
              >
                <ShieldCheck className="h-5 w-5" /> Administração do site
              </Link>
            )}
            <Link
              to="/assinatura"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/75 active:bg-white/10"
            >
              <CreditCard className="h-5 w-5" /> Meu Plano
            </Link>
            <a
              href={APP_DESKTOP_WINDOWS_URL}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/75 active:bg-white/10"
            >
              <MonitorDown className="h-5 w-5" /> Baixar app (Windows)
            </a>
            <InstalarAppMobile
              onDone={() => setOpen(false)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/75 active:bg-white/10"
            />
            <button
              onClick={sair}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/75 active:bg-white/10"
            >
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-out",
          recolhida ? "lg:pl-[100px]" : "lg:pl-[280px]",
        )}
      >
        {/* Celular: cabeçalho + menu em barra horizontal de vidro */}
        <div className="sticky top-0 z-30 lg:hidden">
          <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#1a0f33] to-black px-4 py-2.5 text-white">
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoMark className="h-8 w-8 shrink-0" />
              <p className="truncate text-base font-semibold">{tituloPagina}</p>
            </div>
            <div className="flex items-center gap-1 [&_button]:text-white">
              {user?.email === SITE_ADMIN_EMAIL && (
                <Link
                  to="/admin"
                  aria-label="Administração do site"
                  title="Administração do site"
                  className="rounded-lg p-2 text-violet-300 active:bg-white/10"
                >
                  <ShieldCheck className="h-5 w-5" />
                </Link>
              )}
              <FinancialVisibilityToggle />
              <ThemeToggle />
              <button
                onClick={() => setOpen(true)}
                aria-label="Abrir menu da conta"
                className="-mr-2 rounded-lg p-2 active:bg-white/10"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>
          <nav
            data-barra-mobile
            className="flex gap-1.5 overflow-x-auto border-b border-white/10 bg-black/75 px-3 py-2 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {itensVisiveis.map((item) => {
              const active = ativo(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-ativo={active}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-all duration-200 active:scale-95",
                    active
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_2px_12px_-2px_rgba(139,92,246,0.8)]"
                      : "bg-white/5 text-white/70",
                  )}
                >
                  <span className="relative">
                    <item.icon className="h-4 w-4" />
                    {bolinha(item.to)}
                  </span>
                  {item.label}
                  {item.to === "/whatsapp" && !!whatsappNaoLidas && (
                    <span className="rounded-full bg-violet-300 px-1.5 text-[10px] font-bold text-black">
                      {whatsappNaoLidas > 99 ? "99+" : whatsappNaoLidas}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <header className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-border bg-background/70 px-6 py-3 backdrop-blur lg:flex">
          <div className="min-w-0">
            <h1
              key={tituloPagina}
              className="truncate text-lg font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-left-2 duration-300"
            >
              {tituloPagina}
            </h1>
            <p className="text-xs text-muted-foreground">
              {saudacao()}, <span className="font-medium text-foreground/80">{nomeExibicao}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HeaderMenu label="Relatórios" icon={BarChart3} itens={RELATORIOS_ITENS} />
            <HeaderMenu
              label="Sistema"
              icon={Settings}
              itens={SISTEMA_ITENS}
              topo={{ label: "Meu Plano", to: "/assinatura", icon: CreditCard }}
            />
            <FinancialVisibilityToggle />
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
      <SuporteWhatsapp />
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
  const { data: user } = useCurrentUser();
  // Pedidos de plano das lojas: só a conta do operador do site vê.
  const souOperador = user?.email === SITE_ADMIN_EMAIL;
  return useQuery({
    queryKey: ["notificacoes-header", souOperador],
    queryFn: async () => {
      const [{ data: produtos }, { count: osAguardando }, reclamacoes, pedidosPlano] =
        await Promise.all([
          supabase
            .from("produtos")
            .select("id, nome, quantidade, estoque_minimo")
            .eq("ativo", true),
          supabase
            .from("ordens_servico")
            .select("id", { count: "exact", head: true })
            .eq("status", "aguardando_aprovacao"),
          // Sem permissão de WhatsApp (ou servidor fora) o aviso só não aparece.
          listarReclamacoesPesquisaFn().catch(() => []),
          souOperador ? listarPedidosPlanoPendentesFn().catch(() => []) : Promise.resolve([]),
        ]);

      const baixoEstoque = (produtos ?? []).filter((p) => p.quantidade <= p.estoque_minimo);

      const itens: Notificacao[] = [];
      if (pedidosPlano.length > 0) {
        itens.push({
          id: "pedidos-plano",
          titulo: `${pedidosPlano.length} pedido${pedidosPlano.length > 1 ? "s" : ""} de plano pendente${pedidosPlano.length > 1 ? "s" : ""}`,
          descricao: pedidosPlano
            .slice(0, 3)
            .map((p) => `${p.loja} (${p.plano})`)
            .join(", "),
          to: "/admin",
          icon: CreditCard,
        });
      }
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
      if (reclamacoes.length > 0) {
        itens.push({
          id: "reclamacoes-pesquisa",
          titulo: `${reclamacoes.length} reclamaç${reclamacoes.length > 1 ? "ões" : "ão"} na pesquisa de satisfação`,
          descricao: reclamacoes
            .slice(0, 2)
            .map((r) => `${r.contact_name || "Cliente"}: "${r.content ?? ""}"`)
            .join(" · "),
          to: "/whatsapp-conexao",
          icon: MessageSquareWarning,
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
