import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingLogo } from "./LandingLogo";
import { CTA_PRIMARIO, SECOES_NAV } from "./botoes";
import { LinkCadastro } from "./LinkCadastro";

export function LandingNavbar() {
  const [rolou, setRolou] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 12);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    const aoRedimensionar = () => window.innerWidth >= 1024 && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        rolou || aberto
          ? "border-white/10 bg-zinc-950/80 backdrop-blur-xl"
          : "border-transparent bg-zinc-950/30 backdrop-blur-md",
      )}
    >
      <nav
        aria-label="Principal"
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6",
          rolou ? "h-14" : "h-16 sm:h-18",
        )}
      >
        <a
          href="#inicio"
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="SPACE TECH OS — início"
        >
          <LandingLogo />
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {SECOES_NAV.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            Entrar
          </Link>
          <LinkCadastro className={cn(CTA_PRIMARIO, "h-10 px-5 text-sm")}>
            Começar agora
          </LinkCadastro>
        </div>

        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-controls="menu-mobile"
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 lg:hidden"
        >
          {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {aberto && (
        <div id="menu-mobile" className="lp-menu border-t border-white/10 px-4 pb-5 pt-3 lg:hidden">
          <ul className="space-y-1">
            {SECOES_NAV.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={fechar}
                  className="block rounded-xl px-3 py-3 text-base font-medium text-zinc-200 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              to="/login"
              onClick={fechar}
              className="flex h-12 items-center justify-center rounded-xl border border-white/15 text-sm font-semibold text-white transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              Entrar
            </Link>
            <LinkCadastro onClick={fechar} className={cn(CTA_PRIMARIO, "h-12 text-sm")}>
              Começar agora
            </LinkCadastro>
          </div>
        </div>
      )}
    </header>
  );
}
