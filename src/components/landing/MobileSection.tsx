import { Laptop, Smartphone, Tablet } from "lucide-react";
import type { LandingConteudo } from "@/lib/landing/conteudo";
import { Reveal } from "./Reveal";

const VALORES_ILUSTRATIVOS = ["12", "R$ 1.260", "348", "412", "R$ 18.420"];

export function MobileSection({ mobile }: { mobile: LandingConteudo["mobile"] }) {
  return (
    <section
      aria-labelledby="mobile-titulo"
      className="relative overflow-hidden border-y border-white/5 bg-[#111114] py-20 sm:py-28"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-1/2 h-[420px] w-[420px] -translate-y-1/2 translate-x-1/3 rounded-full bg-violet-600/20 blur-[110px]"
      />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">
            Em qualquer tela
          </p>
          <h2
            id="mobile-titulo"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            {mobile.titulo}
          </h2>
          <p className="mt-4 max-w-lg text-pretty leading-relaxed text-zinc-400">{mobile.texto}</p>
          <ul className="mt-8 flex flex-wrap gap-3" aria-label="Dispositivos compatíveis">
            {[
              { icon: Laptop, l: "Computador" },
              { icon: Tablet, l: "Tablet" },
              { icon: Smartphone, l: "Celular" },
            ].map((d) => (
              <li
                key={d.l}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200"
              >
                <d.icon className="h-4 w-4 text-violet-300" aria-hidden="true" /> {d.l}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal atraso={120} className="flex justify-center">
          <div className="lp-flutuar relative w-[260px] sm:w-[290px]">
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[3rem] bg-violet-600/25 blur-3xl"
            />
            <div className="relative rounded-[2.6rem] border border-white/15 bg-zinc-900 p-2.5 shadow-2xl shadow-violet-950/60">
              <div className="relative overflow-hidden rounded-[2.1rem] bg-zinc-950">
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
                />
                {mobile.imagem ? (
                  <img
                    src={mobile.imagem}
                    alt="SPACE TECH OS no celular"
                    loading="lazy"
                    className="block aspect-[9/19] w-full object-cover object-top"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={`Ilustração do SPACE TECH OS no celular mostrando ${mobile.itens.join(", ")}`}
                    className="aspect-[9/19] px-4 pb-4 pt-10"
                  >
                    <p className="text-[10px] text-zinc-500">Olá 👋</p>
                    <p className="text-sm font-bold text-white">Sua assistência hoje</p>
                    <ul className="mt-4 space-y-2.5">
                      {mobile.itens.map((item, i) => (
                        <li
                          key={`${item}-${i}`}
                          className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.05] px-3.5 py-3"
                        >
                          <span className="text-[11px] text-zinc-400">{item}</span>
                          <span className="text-sm font-bold text-white">
                            {VALORES_ILUSTRATIVOS[i % VALORES_ILUSTRATIVOS.length]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-500 px-3.5 py-3 text-center text-[11px] font-semibold text-white">
                      + Nova ordem de serviço
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
