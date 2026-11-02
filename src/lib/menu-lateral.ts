// Itens do menu lateral e a ordem escolhida pelo usuário
// (Configurações → Menu, salva em profiles.menu_preferencias).
import {
  BarChart3,
  Bot,
  Boxes,
  Calendar,
  Gift,
  HandCoins,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wand2,
  Wrench,
} from "lucide-react";

export const NAV = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard, modulo: null },
  { to: "/ordens", label: "Ordens de serviço", icon: Wrench, modulo: "ordens" },
  { to: "/pdv", label: "PDV", icon: ShoppingCart, modulo: "vendas" },
  { to: "/clientes", label: "Clientes", icon: Users, modulo: "clientes" },
  { to: "/vendas", label: "Vendas", icon: Receipt, modulo: "vendas" },
  { to: "/estoque", label: "Produtos", icon: Package, modulo: "produtos" },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare, modulo: "whatsapp" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, modulo: "financeiro" },
  { to: "/servicos", label: "Serviços", icon: Wrench, modulo: "produtos" },
  { to: "/agenda", label: "Agenda", icon: Calendar, modulo: "agenda" },
  { to: "/cobrancas", label: "Cobranças", icon: Wallet, modulo: "cobrancas" },
  { to: "/crediario", label: "Crediário", icon: HandCoins, modulo: "crediario" },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, modulo: "fornecedores" },
  { to: "/compras", label: "Compras", icon: ShoppingCart, modulo: "compras" },
  { to: "/aparelhos", label: "Aparelhos", icon: Boxes, modulo: "aparelhos" },
  { to: "/seminovos", label: "Compra de Seminovos", icon: Smartphone, modulo: "seminovos" },
  { to: "/garantia", label: "Termos de Garantia", icon: ShieldCheck, modulo: "garantia" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, modulo: "relatorios" },
  { to: "/ferramentas", label: "Ferramentas Inteligentes", icon: Wand2, modulo: "produtos" },
  { to: "/ia-spacetech", label: "IA SPACE TECH", icon: Bot, modulo: null },
  { to: "/indicacoes", label: "Programa de Indicações", icon: Gift, modulo: null },
  { to: "/usuarios", label: "Usuários", icon: UserCog, modulo: "configuracoes" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, modulo: "configuracoes" },
] as const;

export type ItemNav = (typeof NAV)[number];

export type MenuPreferencias = { modo: "auto" | "manual"; ordem: string[] };

export function lerMenuPreferencias(valor: unknown): MenuPreferencias {
  const v = (valor ?? {}) as Partial<MenuPreferencias>;
  return {
    modo: v.modo === "manual" ? "manual" : "auto",
    ordem: Array.isArray(v.ordem) ? v.ordem.filter((x): x is string => typeof x === "string") : [],
  };
}

/** Painel sempre primeiro. Manual: segue a lista salva (itens novos vão ao
 * fim, na ordem padrão). Automático: mais usados primeiro. */
export function ordenarMenu<T extends { to: string }>(
  itens: readonly T[],
  prefs: MenuPreferencias,
  uso: Record<string, number>,
): T[] {
  const padrao = new Map(itens.map((i, n) => [i.to, n]));
  const manual = new Map(prefs.ordem.map((to, n) => [to, n]));
  const peso = (i: T) => manual.get(i.to) ?? 1000 + padrao.get(i.to)!;
  return [...itens].sort((a, b) => {
    if (a.to === "/dashboard") return -1;
    if (b.to === "/dashboard") return 1;
    if (prefs.modo === "manual") return peso(a) - peso(b);
    return (uso[b.to] ?? 0) - (uso[a.to] ?? 0) || padrao.get(a.to)! - padrao.get(b.to)!;
  });
}

export function lerUsoMenu(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem("menu-uso") ?? "{}");
  } catch {
    return {};
  }
}
