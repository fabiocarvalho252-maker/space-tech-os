// Ilustrações menores (HTML/CSS) usadas na seção de benefícios quando o
// admin não enviou uma foto. Valores ilustrativos.
const moldura =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-2xl shadow-violet-950/40 sm:rounded-3xl sm:p-6";

const OS = [
  {
    n: "#1042",
    cliente: "Mariana S.",
    aparelho: "iPhone 13",
    servico: "Troca de tela",
    status: "Em reparo",
    cor: "text-amber-300 bg-amber-400/10",
  },
  {
    n: "#1041",
    cliente: "Carlos R.",
    aparelho: "Galaxy A54",
    servico: "Bateria",
    status: "Pronta",
    cor: "text-emerald-300 bg-emerald-400/10",
  },
  {
    n: "#1040",
    cliente: "Ana P.",
    aparelho: "Moto G84",
    servico: "Conector de carga",
    status: "Aguardando peça",
    cor: "text-sky-300 bg-sky-400/10",
  },
  {
    n: "#1039",
    cliente: "João L.",
    aparelho: "Redmi Note 12",
    servico: "Diagnóstico",
    status: "Orçamento",
    cor: "text-violet-300 bg-violet-400/10",
  },
];

export function MockOsLista() {
  return (
    <div role="img" aria-label="Ilustração da lista de ordens de serviço" className={moldura}>
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl"
      />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-bold text-white">Ordens de serviço</p>
        <span className="rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white">
          + Nova OS
        </span>
      </div>
      <ul className="relative mt-4 space-y-2.5">
        {OS.map((o) => (
          <li
            key={o.n}
            className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.04] p-3"
          >
            <span className="text-xs font-bold text-zinc-300">{o.n}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">
                {o.aparelho} — {o.servico}
              </span>
              <span className="block truncate text-[11px] text-zinc-500">{o.cliente}</span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.cor}`}
            >
              {o.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MockFinanceiro() {
  const linhas = [
    { l: "Receitas", v: "R$ 24.180", c: "text-emerald-300", w: "100%" },
    { l: "Custo das peças", v: "R$ 7.940", c: "text-zinc-300", w: "33%" },
    { l: "Despesas", v: "R$ 5.310", c: "text-rose-300", w: "22%" },
  ];
  return (
    <div role="img" aria-label="Ilustração do resumo financeiro do mês" className={moldura}>
      <div
        aria-hidden="true"
        className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl"
      />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-bold text-white">Resultado do mês</p>
        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
          Margem 45%
        </span>
      </div>
      <p className="relative mt-4 text-3xl font-extrabold tracking-tight text-white">R$ 10.930</p>
      <p className="relative text-xs text-zinc-500">Lucro líquido</p>
      <ul className="relative mt-5 space-y-3">
        {linhas.map((x) => (
          <li key={x.l}>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{x.l}</span>
              <span className={`font-semibold ${x.c}`}>{x.v}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                style={{ width: x.w }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
        {[
          ["PIX", "48%"],
          ["Cartão", "37%"],
          ["Dinheiro", "15%"],
        ].map(([f, p]) => (
          <div key={f} className="rounded-xl border border-white/5 bg-white/[0.04] py-2">
            <p className="text-sm font-bold text-white">{p}</p>
            <p className="text-[10px] text-zinc-500">{f}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
