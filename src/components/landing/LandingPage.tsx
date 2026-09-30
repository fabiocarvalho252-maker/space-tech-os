import type { LandingConteudo } from "@/lib/landing/conteudo";
import type { PlanoPublico } from "@/lib/landing/landing.functions";
import { LandingNavbar } from "./LandingNavbar";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { Benefits } from "./Benefits";
import { HowItWorks } from "./HowItWorks";
import { MobileSection } from "./MobileSection";
import { Plans } from "./Plans";
import { Testimonials } from "./Testimonials";
import { FinalCta } from "./FinalCta";
import { LandingFooter } from "./LandingFooter";

export function LandingPage({
  conteudo,
  planos,
}: {
  conteudo: LandingConteudo;
  planos: PlanoPublico[];
}) {
  return (
    <div className="lp-raiz min-h-screen overflow-x-clip bg-zinc-950 text-zinc-100 antialiased selection:bg-violet-500/40">
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <LandingNavbar />
      <main id="conteudo">
        <Hero hero={conteudo.hero} />
        <Features recursos={conteudo.recursos} />
        <Benefits beneficios={conteudo.beneficios} />
        <HowItWorks passos={conteudo.passos} />
        <MobileSection mobile={conteudo.mobile} />
        <Plans planos={planos} textos={conteudo.planos} />
        <Testimonials depoimentos={conteudo.depoimentos} />
        <FinalCta cta={conteudo.ctaFinal} />
      </main>
      <LandingFooter />
    </div>
  );
}
