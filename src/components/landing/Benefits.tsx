import { Check } from "lucide-react";
import type { LandingConteudo } from "@/lib/landing/conteudo";
import { Reveal } from "./Reveal";
import { MockFinanceiro, MockOsLista } from "./MiniMockups";

export function Benefits({ beneficios }: { beneficios: LandingConteudo["beneficios"] }) {
  return (
    <section
      id="beneficios"
      aria-labelledby="beneficios-titulo"
      className="scroll-mt-20 border-y border-white/5 bg-[#111114] py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Benefícios
          </p>
          <h2
            id="beneficios-titulo"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            {beneficios.titulo}
          </h2>
          {beneficios.subtitulo && (
            <p className="mt-4 text-pretty text-zinc-400">{beneficios.subtitulo}</p>
          )}
        </Reveal>

        <div className="mt-16 space-y-20 sm:space-y-24">
          {beneficios.blocos.map((bloco, i) => {
            const invertido = i % 2 === 1;
            return (
              <div
                key={`${bloco.titulo}-${i}`}
                className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <Reveal className={invertido ? "lg:order-2" : undefined}>
                  <h3 className="text-balance text-2xl font-bold text-white sm:text-3xl">
                    {bloco.titulo}
                  </h3>
                  {bloco.texto && (
                    <p className="mt-4 text-pretty leading-relaxed text-zinc-400">{bloco.texto}</p>
                  )}
                  <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                    {bloco.itens.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-zinc-200">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-violet-300">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <Reveal atraso={120} className={invertido ? "lg:order-1" : undefined}>
                  {bloco.imagem ? (
                    <img
                      src={bloco.imagem}
                      alt={bloco.titulo}
                      loading="lazy"
                      className="w-full rounded-2xl border border-white/10 shadow-2xl shadow-violet-950/40 sm:rounded-3xl"
                    />
                  ) : i % 2 === 0 ? (
                    <MockOsLista />
                  ) : (
                    <MockFinanceiro />
                  )}
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
