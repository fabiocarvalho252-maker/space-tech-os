import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PurchaseCard } from "./PurchaseCard";
import type { MeuCliente, MinhaVenda } from "./types";

type Filtro = "todos" | "online" | "loja";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "online", label: "Pedidos online" },
  { id: "loja", label: "Compras na loja" },
];

const LIMITE = 30;

export function PurchasesTab({ cliente }: { cliente: MeuCliente }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { data: vendas, isLoading } = useQuery({
    queryKey: ["minha-conta-vendas", cliente.id, filtro],
    queryFn: async (): Promise<MinhaVenda[]> => {
      let query = supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendas.origem not in the generated Database type yet
        .from("vendas" as any)
        .select("id, numero, created_at, total, status, origem, venda_itens(descricao, quantidade)")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(LIMITE);
      if (filtro !== "todos") query = query.eq("origem", filtro);
      const { data, error } = await query;
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
        origem: v.origem,
        itens: v.venda_itens ?? [],
      }));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              filtro === f.id
                ? "border-[#2563eb] bg-[#eff6ff] text-[#2563eb]"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : !vendas || vendas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
          Você ainda não possui pedidos.
        </div>
      ) : (
        <div className="space-y-2">
          {vendas.map((v) => (
            <PurchaseCard key={v.id} venda={v} />
          ))}
        </div>
      )}
    </div>
  );
}
