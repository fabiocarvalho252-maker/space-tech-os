import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark, LogoWord } from "@/components/Logo";

export function ClientAccountHeader({ nome }: { nome: string }) {
  const navigate = useNavigate();

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <LogoMark className="h-7 w-7" />
          <span className="hidden sm:inline">
            <LogoWord className="h-4" />
          </span>
          <span className="ml-1 text-slate-400">|</span>
          <span>Catálogo</span>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            Olá, <strong className="text-slate-900">{nome}</strong>
          </span>
          {/* No cart/checkout flow exists yet in this project — kept as a
              non-destructive placeholder, ready to wire up once one does. */}
          <Link
            to="/"
            title="Carrinho — em breve"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <ShoppingCart className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={sair}
            title="Sair"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pb-4 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Minha Conta</h1>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à loja
        </Link>
      </div>
    </header>
  );
}
