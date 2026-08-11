import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, User, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "./MetricCard";
import { PurchaseCard } from "./PurchaseCard";
import { ServiceOrderCard } from "./ServiceOrderCard";
import type { MeuCliente, MinhaOs, MinhaVenda } from "./types";

const LIMITE_RECENTES = 5;

export function OverviewTab({
  cliente,
  onIrParaDados,
  onAbrirOs,
}: {
  cliente: MeuCliente;
  onIrParaDados: () => void;
  onAbrirOs: (os: MinhaOs) => void;
}) {
  const { data: totalCompras } = useQuery({
    queryKey: ["minha-conta-total-compras", cliente.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vendas")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cliente.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: totalOs } = useQuery({
    queryKey: ["minha-conta-total-os", cliente.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("cliente_id", cliente.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: compras, isLoading: carregandoCompras } = useQuery({
    queryKey: ["minha-conta-ultimas-compras", cliente.id],
    queryFn: async (): Promise<MinhaVenda[]> => {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendas.origem not in the generated Database type yet
        .from("vendas" as any)
        .select("id, numero, created_at, total, status, origem, venda_itens(descricao, quantidade)")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE_RECENTES);
      if (error) throw error;
      type Linha = {
        id: string;
        numero: number;
        created_at: string;
        total: number;
        status: string;
        origem: "loja" | "online";
        venda_itens: { descricao: string; quantidade: number }[] | null;
      };
      return ((data ?? []) as unknown as Linha[]).map((v) => ({
        id: v.id,
        numero: v.numero,
        created_at: v.created_at,
        total: Number(v.total),
        status: v.status,
        origem: v.origem as "loja" | "online",
        itens: v.venda_itens ?? [],
      }));
    },
  });

  const { data: ordens, isLoading: carregandoOs } = useQuery({
    queryKey: ["minha-conta-ultimas-os", cliente.id],
    queryFn: async (): Promise<MinhaOs[]> => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE_RECENTES);
      if (error) throw error;
      return (data ?? []) as unknown as MinhaOs[];
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">
          Olá, {cliente.nome.split(" ")[0]}!
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Confira suas compras, ordens de serviço e dados da sua conta.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={ShoppingBag} label="Compras" value={totalCompras ?? "—"} />
        <MetricCard icon={Wrench} label="Ordens de Serviço" value={totalOs ?? "—"} />
        <MetricCard icon={User} label="Meus Dados" value=" " onClick={onIrParaDados} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-bold text-slate-900">Últimas compras</h3>
        {carregandoCompras ? (
          <CarregandoLista />
        ) : !compras || compras.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Você ainda não possui compras.</p>
        ) : (
          <div className="space-y-2">
            {compras.map((v) => (
              <PurchaseCard key={v.id} venda={v} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 font-bold text-slate-900">Últimas Ordens de Serviço</h3>
        {carregandoOs ? (
          <CarregandoLista />
        ) : !ordens || ordens.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Você ainda não possui Ordens de Serviço.
          </p>
        ) : (
          <div className="space-y-2">
            {ordens.map((os) => (
              <ServiceOrderCard key={os.id} os={os} onDetalhes={() => onAbrirOs(os)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CarregandoLista() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}
