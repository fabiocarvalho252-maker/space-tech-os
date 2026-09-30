// Classes dos CTAs da landing (links reais para /cadastro e /login).
export const CTA_PRIMARIO =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-6 font-semibold text-white shadow-lg shadow-violet-900/40 transition duration-200 hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:hover:scale-100";

export const CTA_SECUNDARIO =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 font-semibold text-white transition duration-200 hover:scale-[1.02] hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 motion-reduce:hover:scale-100";

export const SECOES_NAV = [
  { id: "recursos", label: "Recursos" },
  { id: "beneficios", label: "Benefícios" },
  { id: "como-funciona", label: "Como funciona" },
  { id: "planos", label: "Planos" },
] as const;
