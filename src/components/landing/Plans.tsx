import { ArrowRight, Check } from "lucide-react";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FEATURES_EXIBICAO } from "@/lib/planos/features";
import type { LandingConteudo } from "@/lib/landing/conteudo";
import type { PlanoPublico } from "@/lib/landing/landing.functions";
import { CTA_PRIMARIO } from "./botoes";
import { Reveal } from "./Reveal";
import { LinkCadastro } from "./LinkCadastro";

// Planos ativos, preços e recursos vêm do banco (os mesmos de /planos e do
// painel admin) — nada é fixo aqui.
export function Plans({
  planos,
  textos,
}: {
  planos: PlanoPublico[];
  textos: LandingConteudo["planos"];
}) {
  const umSo = planos.length <= 1;
  return (
    <section id="planos" aria-labelledby="planos-titulo" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-400">Planos</p>
          <h2
            id="planos-titulo"
            className="mt-3 text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            {textos.titulo}
          </h2>
          {textos.subtitulo && <p className="mt-4 text-pretty text-zinc-400">{textos.subtitulo}</p>}
        </Reveal>

        <div
          className={cn("mx-auto mt-12 grid gap-6", umSo ? "max-w-md" : "max-w-4xl md:grid-cols-2")}
        >
          {(planos.length ? planos : [null]).map((p, i) => {
            const recursos = p
              ? FEATURES_EXIBICAO.filter((f) => p.recursos.includes(f.feature)).map((f) => f.label)
              : [];
            return (
              <Reveal key={p?.id ?? "sem-plano"} atraso={i * 100}>
                <article
                  className={cn(
                    "relative flex h-full flex-col rounded-3xl border p-7 sm:p-8",
                    i === 0
                      ? "border-violet-400/40 bg-gradient-to-b from-violet-600/15 to-white/[0.02] shadow-2xl shadow-violet-950/50"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <h3 className="text-xl font-extrabold text-white">
                    {p?.nome ?? "SPACE TECH OS"}
                  </h3>
                  {p?.descricao && (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.descricao}</p>
                  )}

                  <div className="mt-6">
                    {p?.precoMensal != null ? (
                      <>
                        <p className="text-4xl font-extrabold tracking-tight text-white">
                          {brl(p.precoMensal)}
                          <span className="text-base font-medium text-zinc-400">/mês</span>
                        </p>
                        {p.precoAnual != null && (
                          <p className="mt-1 text-sm text-zinc-400">
                            ou {brl(p.precoAnual)}/ano
                            {p.descontoAnualPct
                              ? ` (${Number(p.descontoAnualPct)}% de desconto)`
                              : ""}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-2xl font-extrabold text-white">{textos.textoSemPreco}</p>
                    )}
                  </div>

                  {recursos.length > 0 && (
                    <ul className="mt-7 grid flex-1 gap-3 sm:grid-cols-2">
                      {recursos.map((r) => (
                        <li key={r} className="flex items-start gap-2.5 text-sm text-zinc-200">
                          <Check
                            className="mt-0.5 h-4 w-4 shrink-0 text-violet-300"
                            aria-hidden="true"
                          />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}

                  <LinkCadastro
                    className={cn(CTA_PRIMARIO, "mt-8 h-12 w-full text-sm uppercase tracking-wide")}
                  >
                    Começar agora <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </LinkCadastro>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
