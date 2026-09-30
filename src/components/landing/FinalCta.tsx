import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandingConteudo } from "@/lib/landing/conteudo";
import { CTA_SECUNDARIO } from "./botoes";
import { Reveal } from "./Reveal";
import { LinkCadastro } from "./LinkCadastro";

export function FinalCta({ cta }: { cta: LandingConteudo["ctaFinal"] }) {
  return (
    <section aria-labelledby="cta-final-titulo" className="px-4 pb-20 sm:px-6 sm:pb-28">
      <Reveal className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-700 via-violet-600 to-violet-800 px-6 py-14 text-center shadow-2xl shadow-violet-950/60 sm:px-12 sm:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_90%_100%,rgba(9,9,11,0.45),transparent_50%)]"
        />
        <div className="relative">
          <h2
            id="cta-final-titulo"
            className="mx-auto max-w-2xl text-balance text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
          >
            {cta.titulo}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-violet-100">{cta.texto}</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <LinkCadastro className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-white px-7 text-base font-bold uppercase tracking-wide text-violet-700 shadow-lg transition duration-200 hover:scale-[1.02] hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700 motion-reduce:hover:scale-100">
              {cta.ctaPrimario} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkCadastro>
            <Link
              to="/login"
              className={cn(
                CTA_SECUNDARIO,
                "h-13 border-white/30 bg-white/10 text-base uppercase tracking-wide",
              )}
            >
              {cta.ctaSecundario}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
