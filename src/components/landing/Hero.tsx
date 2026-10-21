import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandingConteudo } from "@/lib/landing/conteudo";
import { DashboardMockup } from "./DashboardMockup";
import { CTA_PRIMARIO, CTA_SECUNDARIO } from "./botoes";
import { LinkCadastro } from "./LinkCadastro";

export function Hero({ hero }: { hero: LandingConteudo["hero"] }) {
  return (
    <section id="inicio" className="relative overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-20">
      {/* brilho roxo de fundo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-violet-600/25 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {hero.selo && (
            <p className="lp-entrar inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-200 sm:text-sm">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {hero.selo}
            </p>
          )}
          <h1
            className="lp-entrar mt-6 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            {hero.titulo}
          </h1>
          <p
            className="lp-entrar mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            <strong className="font-semibold text-white">SPACE TECH OS</strong> — {hero.subtitulo}
          </p>

          <div
            className="lp-entrar mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
            style={{ animationDelay: "260ms" }}
          >
            <LinkCadastro className={cn(CTA_PRIMARIO, "h-13 text-base uppercase tracking-wide")}>
              {hero.ctaPrimario} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkCadastro>
            <Link
              to="/login"
              className={cn(CTA_SECUNDARIO, "h-13 text-base uppercase tracking-wide")}
            >
              {hero.ctaSecundario}
            </Link>
          </div>
          {hero.nota && (
            <p className="lp-entrar mt-4 text-sm text-zinc-500" style={{ animationDelay: "320ms" }}>
              {hero.nota}
            </p>
          )}
        </div>

        <div
          className="lp-entrar-escala relative mx-auto mt-12 max-w-5xl sm:mt-16"
          style={{ animationDelay: "380ms" }}
        >
          <div
            aria-hidden="true"
            className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-violet-500/30 via-violet-600/10 to-transparent blur-2xl"
          />
          <div className="lp-flutuar relative">
            {hero.imagem ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-violet-950/50 sm:rounded-3xl">
                <img
                  src={hero.imagem}
                  alt="Tela do SPACE TECH OS"
                  className="block h-auto w-full"
                  fetchPriority="high"
                />
              </div>
            ) : (
              <DashboardMockup />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
