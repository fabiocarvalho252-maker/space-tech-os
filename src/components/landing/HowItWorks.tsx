import type { LandingConteudo } from "@/lib/landing/conteudo";
import { Reveal } from "./Reveal";

export function HowItWorks({ passos }: { passos: LandingConteudo["passos"] }) {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Passo a passo
          </p>
          <h2
            id="como-funciona-titulo"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            {passos.titulo}
          </h2>
        </Reveal>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          {/* conector entre os passos (desktop) */}
          <span
            aria-hidden="true"
            className="absolute left-[16.66%] right-[16.66%] top-7 hidden h-px bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0 md:block"
          />
          {passos.itens.map((p, i) => (
            <Reveal
              as="li"
              key={`${p.titulo}-${i}`}
              atraso={i * 120}
              className="relative text-center"
            >
              <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-zinc-950 text-lg font-extrabold text-violet-300 shadow-lg shadow-violet-950/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 text-lg font-bold text-white">{p.titulo}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">
                {p.texto}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
