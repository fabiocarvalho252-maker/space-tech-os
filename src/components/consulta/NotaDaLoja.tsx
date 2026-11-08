// Selo "⭐ 4,9 · 37 avaliações" da loja nas páginas públicas (Área do Cliente
// e avaliação da venda). nota_publica_loja() só devolve com 3+ avaliações.
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function NotaDaLoja({ tipo, id }: { tipo: "os" | "venda"; id: string }) {
  const { data } = useQuery({
    queryKey: ["nota-publica-loja", tipo, id],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nota_publica_loja", {
        p_tipo: tipo,
        p_identificador: id,
      });
      if (error) throw error;
      return (data ?? null) as { media: number; total: number } | null;
    },
  });
  if (!data) return null;
  return (
    <div className="mb-4 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        <strong>{Number(data.media).toFixed(1).replace(".", ",")}</strong>
        <span className="text-muted-foreground">· {data.total} avaliações de clientes</span>
      </span>
    </div>
  );
}
