import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
import { obterLandingPublica } from "@/lib/landing/landing.functions";
import { LANDING_PADRAO } from "@/lib/landing/conteudo";
import { useRedirecionarSeLogado } from "@/hooks/useRedirecionarSeLogado";
import { IndicacaoContext } from "@/components/landing/indicacao";
import { salvarCodigoIndicacao } from "@/lib/referrals/link";

const TITULO = "SPACE TECH OS | Sistema para Assistência Técnica";
const DESCRICAO =
  "SPACE TECH OS é um sistema completo para gestão de assistência técnica, com ordens de serviço, estoque, vendas, clientes, financeiro e muito mais.";

// Landing page pública. O login fica em /login e o cadastro em /cadastro;
// quem já está logado é levado direto ao painel (useRedirecionarSeLogado).
// Textos, fotos e depoimentos são editados em /admin/landing.
export const Route = createFileRoute("/")({
  // ?previa=1: o admin (logado) vê a landing em vez de ir para o painel —
  // usado pelo botão "Ver página" de /admin/landing.
  // ?ref=CÓDIGO: link de indicação (getReferralLink) — guardado e repassado
  // ao /cadastro, onde a indicação é registrada.
  validateSearch: (search: Record<string, unknown>): { previa?: boolean; ref?: string } => {
    const ref = typeof search["ref"] === "string" ? search["ref"].trim() : "";
    return { ...(search["previa"] ? { previa: true } : {}), ...(ref ? { ref } : {}) };
  },
  loader: () => obterLandingPublica(),
  head: ({ loaderData }) => {
    const ogImagem = loaderData?.conteudo.seo.ogImagem;
    return {
      meta: [
        { title: TITULO },
        { name: "description", content: DESCRICAO },
        { property: "og:title", content: TITULO },
        { property: "og:description", content: DESCRICAO },
        { name: "twitter:title", content: TITULO },
        { name: "twitter:description", content: DESCRICAO },
        ...(ogImagem
          ? [
              { property: "og:image", content: ogImagem },
              { name: "twitter:image", content: ogImagem },
            ]
          : []),
      ],
    };
  },
  component: Landing,
});

function Landing() {
  const { previa, ref } = Route.useSearch();
  // Mesmo comportamento do /cadastro: o último link de indicação visto vale.
  useEffect(() => {
    if (ref) salvarCodigoIndicacao(ref);
  }, [ref]);
  useRedirecionarSeLogado(!previa);
  const data = Route.useLoaderData();
  return (
    <IndicacaoContext.Provider value={ref}>
      <LandingPage conteudo={data?.conteudo ?? LANDING_PADRAO} planos={data?.planos ?? []} />
    </IndicacaoContext.Provider>
  );
}
