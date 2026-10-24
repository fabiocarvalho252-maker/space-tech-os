import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Package,
  Receipt,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
  Wrench,
} from "lucide-react";

// Single source of truth for the Home quick-access cards *and* the global
// F1-F8 keyboard shortcuts — AppShell's keydown listener and
// QuickAccessCards both read this list, so a card's route/icon/gradient and
// its keyboard shortcut can never drift apart.
export type Atalho = {
  tecla: string;
  label: string;
  to: string;
  icon: LucideIcon;
  gradiente: string;
};

export const ATALHOS: Atalho[] = [
  {
    tecla: "F1",
    label: "Clientes",
    to: "/clientes",
    icon: Users,
    gradiente: "from-indigo-400 to-indigo-500",
  },
  {
    tecla: "F2",
    label: "Produtos",
    to: "/estoque",
    icon: Package,
    gradiente: "from-amber-400 to-orange-400",
  },
  {
    tecla: "F3",
    label: "Serviços",
    to: "/servicos",
    icon: Wrench,
    gradiente: "from-cyan-400 to-teal-400",
  },
  {
    tecla: "F4",
    label: "Ordens",
    to: "/ordens",
    icon: ClipboardList,
    gradiente: "from-pink-400 to-rose-400",
  },
  {
    tecla: "F6",
    label: "Vendas",
    to: "/vendas",
    icon: ShoppingCart,
    gradiente: "from-emerald-400 to-green-400",
  },
  {
    tecla: "F7",
    label: "Lançamentos",
    to: "/financeiro",
    icon: Receipt,
    gradiente: "from-amber-300 to-yellow-400",
  },
  {
    tecla: "F8",
    label: "PDV",
    to: "/pdv",
    icon: Store,
    gradiente: "from-purple-400 to-indigo-400",
  },
  // F5 fica livre de propósito: é o "recarregar" do navegador.
  {
    tecla: "F9",
    label: "Seminovos",
    to: "/seminovos",
    icon: Smartphone,
    gradiente: "from-sky-400 to-blue-500",
  },
];

// True when a keyboard shortcut should be ignored because focus is on
// something the user is typing into — never hijack F-keys away from a form.
export function estaDigitando(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// Teclas que a tela aberta assumiu para si (o PDV usa F2/F4/F9 para buscar,
// escolher cliente e finalizar). Enquanto estiverem aqui, o atalho global da
// mesma tecla não navega — a tela registra ao montar e remove ao sair.
export const teclasDaTela = new Set<string>();
