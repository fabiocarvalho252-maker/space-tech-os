import type { LandingConteudo } from "@/lib/landing/conteudo";
import { ICONE_LANDING } from "./icones";
import { Reveal } from "./Reveal";

export function Features({ recursos }: { recursos: LandingConteudo["recursos"] }) {
  return (
    <section
      id="recursos"
      aria-labelledby="recursos-titulo"
      className="scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Recursos
          </p>
          <h2
            id="recursos-titulo"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            {recursos.titulo}
          </h2>
          {recursos.subtitulo && (
            <p className="mt-4 text-pretty text-zinc-400">{recursos.subtitulo}</p>
          )}
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recursos.itens.map((item, i) => {
            const Icone = ICONE_LANDING[item.icone];
            return (
              <Reveal as="li" key={`${item.titulo}-${i}`} atraso={(i % 4) * 70}>
                <article className="group relative h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:bg-white/[0.05] hover:shadow-xl hover:shadow-violet-950/40 motion-reduce:hover:translate-y-0">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600/15 text-violet-300 ring-1 ring-violet-400/20 transition duration-300 group-hover:scale-110 group-hover:bg-violet-600/25 motion-reduce:group-hover:scale-100">
                    <Icone className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 flex flex-wrap items-center gap-2 text-lg font-bold text-white">
                    {item.titulo}
                    {item.emBreve && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        Em breve
                      </span>
                    )}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.descricao}</p>
                </article>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
