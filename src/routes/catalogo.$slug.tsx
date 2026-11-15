// Vitrine pública (sem login) da loja: /catalogo/<subdominio>. Lista os
// produtos e serviços que a loja liberou em Configurações → Catálogo. O
// cliente monta um pedido e envia pelo WhatsApp da loja. Os dados vêm da
// função catalogo_publico (SECURITY DEFINER), que não expõe custo, fornecedor
// nem quantidade exata de estoque.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, MessageCircle, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/catalogo/$slug")({
  head: () => ({ meta: [{ title: "Catálogo" }] }),
  component: CatalogoPublico,
});

type Item = {
  id: string;
  nome: string;
  descricao: string | null;
  marca: string | null;
  categoria: string | null;
  preco: number;
  imagem: string | null;
  tipo: "produto" | "servico";
  tempo_min: number | null;
  garantia_dias: number | null;
  disponivel: boolean;
};

type Vitrine = {
  slug: string;
  loja: string;
  logo: string | null;
  whatsapp: string | null;
  whatsapp_flutuante: boolean;
  mensagem_inicial: string;
  endereco: string | null;
  itens: Item[];
};

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const digitos = (s: string | null) => (s ?? "").replace(/\D/g, "");

function CatalogoPublico() {
  const { slug } = Route.useParams();
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>("todas");
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  const { data: vitrine, isLoading, error } = useQuery({
    queryKey: ["catalogo-publico", slug],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("catalogo_publico", { p_slug: slug });
      if (error) throw error;
      return (data ?? null) as Vitrine | null;
    },
    retry: false,
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();
    vitrine?.itens.forEach((i) => i.categoria && set.add(i.categoria));
    return Array.from(set).sort();
  }, [vitrine]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (vitrine?.itens ?? []).filter((i) => {
      if (categoria !== "todas" && i.categoria !== categoria) return false;
      if (!termo) return true;
      return [i.nome, i.marca, i.categoria, i.descricao]
        .filter(Boolean)
        .some((t) => String(t).toLowerCase().includes(termo));
    });
  }, [vitrine, busca, categoria]);

  if (isLoading) {
    return (
      <Centro>
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </Centro>
    );
  }

  if (error || !vitrine) {
    return (
      <Centro>
        <AlertCircle className="h-10 w-10 text-slate-400" />
        <h1 className="mt-3 text-lg font-bold">Catálogo indisponível</h1>
        <p className="mt-1 max-w-xs text-center text-sm text-slate-500">
          Este catálogo não existe ou está temporariamente fechado.
        </p>
      </Centro>
    );
  }

  const itensCarrinho = vitrine.itens
    .filter((i) => carrinho[i.id])
    .map((i) => ({ item: i, qtd: carrinho[i.id] ?? 0 }));
  const totalQtd = itensCarrinho.reduce((s, x) => s + x.qtd, 0);
  const total = itensCarrinho.reduce((s, x) => s + x.qtd * x.item.preco, 0);
  const whats = digitos(vitrine.whatsapp);

  const ajustar = (id: string, delta: number) =>
    setCarrinho((c) => {
      const q = Math.max(0, (c[id] ?? 0) + delta);
      const next = { ...c };
      if (q === 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const mensagemPedido = () => {
    const linhas = itensCarrinho.map(
      ({ item, qtd }) => `• ${qtd}x ${item.nome} — ${brl(item.preco * qtd)}`,
    );
    return [
      vitrine.mensagem_inicial || "Olá, gostaria de fazer um pedido:",
      "",
      ...linhas,
      "",
      `Total estimado: ${brl(total)}`,
    ].join("\n");
  };

  const linkWhats = (texto: string) =>
    `https://wa.me/55${whats}?text=${encodeURIComponent(texto)}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {vitrine.logo ? (
            <img src={vitrine.logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white font-bold">
              {vitrine.loja.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{vitrine.loja}</h1>
            {vitrine.endereco && (
              <p className="truncate text-xs text-slate-500">{vitrine.endereco}</p>
            )}
          </div>
          <Button
            variant="outline"
            className="relative gap-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
            onClick={() => setCarrinhoAberto(true)}
            aria-label="Abrir pedido"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Pedido</span>
            {totalQtd > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[11px] font-bold text-white">
                {totalQtd}
              </span>
            )}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-32 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto ou serviço"
              className="h-11 bg-white pl-9"
            />
          </div>
          {categorias.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["todas", ...categorias].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoria(c)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
                    categoria === c
                      ? "border-violet-600 bg-violet-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
                  }`}
                >
                  {c === "todas" ? "Todas" : c}
                </button>
              ))}
            </div>
          )}
        </div>

        {filtrados.length === 0 ? (
          <p className="mt-16 text-center text-sm text-slate-500">
            {vitrine.itens.length === 0
              ? "Nenhum item disponível no momento."
              : "Nada encontrado para essa busca."}
          </p>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filtrados.map((item) => {
              const qtd = carrinho[item.id] ?? 0;
              return (
                <li
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex aspect-square items-center justify-center bg-slate-100">
                    {item.imagem ? (
                      <img src={item.imagem} alt={item.nome} loading="lazy" className="h-full w-full object-contain" />
                    ) : (
                      <ShoppingBag className="h-10 w-10 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex flex-wrap gap-1">
                      {item.tipo === "servico" && <Badge variant="secondary">Serviço</Badge>}
                      {!item.disponivel && <Badge variant="outline">Sob consulta</Badge>}
                    </div>
                    <h2 className="line-clamp-2 text-sm font-semibold leading-snug">{item.nome}</h2>
                    {item.marca && <p className="text-xs text-slate-500">{item.marca}</p>}
                    {item.tipo === "servico" && (item.tempo_min || item.garantia_dias) && (
                      <p className="text-xs text-slate-500">
                        {item.tempo_min ? `~${item.tempo_min} min` : ""}
                        {item.tempo_min && item.garantia_dias ? " · " : ""}
                        {item.garantia_dias ? `${item.garantia_dias} dias de garantia` : ""}
                      </p>
                    )}
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <span className="text-base font-bold text-violet-700">{brl(item.preco)}</span>
                      {item.disponivel ? (
                        qtd > 0 ? (
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => ajustar(item.id, -1)} aria-label="Diminuir">
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold">{qtd}</span>
                            <Button size="icon" className="h-8 w-8 bg-violet-600 hover:bg-violet-700" onClick={() => ajustar(item.id, 1)} aria-label="Aumentar">
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700" onClick={() => ajustar(item.id, 1)}>
                            Adicionar
                          </Button>
                        )
                      ) : (
                        <Button size="sm" variant="outline" className="h-8" disabled={!whats}
                          onClick={() => window.open(linkWhats(`Olá, gostaria de consultar disponibilidade de: ${item.nome}`), "_blank")}>
                          Consultar
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {totalQtd > 0 && !carrinhoAberto && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">{totalQtd} item(s)</p>
              <p className="font-bold">{brl(total)}</p>
            </div>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setCarrinhoAberto(true)}>
              Ver pedido
            </Button>
          </div>
        </div>
      )}

      {carrinhoAberto && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setCarrinhoAberto(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Seu pedido</h2>
              <Button variant="ghost" size="icon" onClick={() => setCarrinhoAberto(false)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {itensCarrinho.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Nenhum item adicionado.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {itensCarrinho.map(({ item, qtd }) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.nome}</p>
                      <p className="text-xs text-slate-500">{brl(item.preco)} cada</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => ajustar(item.id, -1)} aria-label="Diminuir">
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center text-sm">{qtd}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => ajustar(item.id, 1)} aria-label="Aumentar">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">Total estimado</span>
              <span className="text-lg font-bold">{brl(total)}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              O valor final é confirmado pela loja. O pedido é enviado pelo WhatsApp.
            </p>
            <Button
              className="mt-4 w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={itensCarrinho.length === 0 || !whats}
              onClick={() => window.open(linkWhats(mensagemPedido()), "_blank")}
            >
              <MessageCircle className="h-4 w-4" /> Enviar pedido pelo WhatsApp
            </Button>
            {!whats && (
              <p className="mt-2 text-center text-xs text-slate-500">Esta loja ainda não informou um WhatsApp.</p>
            )}
          </div>
        </div>
      )}

      {vitrine.whatsapp_flutuante && whats && !carrinhoAberto && totalQtd === 0 && (
        <a
          href={linkWhats(vitrine.mensagem_inicial || "Olá, gostaria de mais informações.")}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600"
          aria-label="Falar pelo WhatsApp"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">{children}</div>;
}
