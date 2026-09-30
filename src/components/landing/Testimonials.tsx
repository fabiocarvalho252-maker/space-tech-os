import { PackageSearch, PhoneCall, Quote, Wallet } from "lucide-react";
import type { LandingConteudo } from "@/lib/landing/conteudo";
import { Reveal } from "./Reveal";

// Sem depoimentos reais cadastrados (em /admin/landing), a seção mostra
// situações do dia a dia e o recurso do sistema que resolve cada uma — nada
// de clientes ou números inventados.
const ROTINA = [
  {
    icon: PhoneCall,
    situacao: "Cliente ligando para saber do aparelho?",
    resposta: "Envie a OS pelo WhatsApp ou deixe ele consultar o andamento pelo QR code impresso.",
  },
  {
    icon: PackageSearch,
    situacao: "Peça que some do estoque?",
    resposta: "Cada venda baixa o estoque automaticamente, com alerta de estoque mínimo.",
  },
  {
    icon: Wallet,
    situacao: "Caixa que não fecha?",
    resposta: "Entradas e saídas registradas no financeiro, com o resultado do dia e do mês.",
  },
];

export function Testimonials({ depoimentos }: { depoimentos: LandingConteudo["depoimentos"] }) {
  const temDepoimentos = depoimentos.itens.length > 0;
  return (
    <section aria-labelledby="depoimentos-titulo" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2
            id="depoimentos-titulo"
            className="text-balance text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          >
            {depoimentos.titulo}
          </h2>
          {depoimentos.subtitulo && (
            <p className="mt-4 text-pretty text-zinc-400">{depoimentos.subtitulo}</p>
          )}
        </Reveal>

        {temDepoimentos ? (
          <ul className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {depoimentos.itens.map((d, i) => (
              <Reveal as="li" key={`${d.nome}-${i}`} atraso={(i % 3) * 90}>
                <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <Quote className="h-6 w-6 text-violet-400" aria-hidden="true" />
                  <blockquote className="mt-4 flex-1 text-pretty leading-relaxed text-zinc-200">
                    “{d.texto}”
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    {d.foto ? (
                      <img
                        src={d.foto}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 text-sm font-bold text-violet-200"
                      >
                        {d.nome.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span>
                      <span className="block text-sm font-semibold text-white">{d.nome}</span>
                      {d.empresa && (
                        <span className="block text-xs text-zinc-500">{d.empresa}</span>
                      )}
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
        ) : (
          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {ROTINA.map((r, i) => (
              <Reveal as="li" key={r.situacao} atraso={i * 90}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <r.icon className="h-6 w-6 text-violet-400" aria-hidden="true" />
                  <p className="mt-4 font-semibold text-white">{r.situacao}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{r.resposta}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
