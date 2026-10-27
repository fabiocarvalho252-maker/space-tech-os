// Histórico da "Consultar Peças". "Resposta recebida" só é marcada pelo
// usuário — o sistema não lê a conversa do wa.me para saber se houve resposta.
import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, History, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_CONSULTA_LABEL,
  linkConsultaWhatsapp,
  type StatusConsulta,
} from "@/lib/consulta-pecas";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const POR_PAGINA = 30;

const COR: Record<StatusConsulta, string> = {
  preparada: "bg-secondary text-muted-foreground",
  conversa_aberta: "bg-primary/10 text-primary",
  respondida: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const dataHora = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export function HistoricoConsultasDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const termo = busca.trim();

  const consultas = useInfiniteQuery({
    queryKey: ["fornecedor-consultas-pecas", termo],
    enabled: open,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase
        .from("fornecedor_consultas_pecas")
        .select(
          "id, fornecedor_nome, whatsapp, peca, marca, modelo, qualidade, mensagem, status, created_at, conversa_aberta_em, respondida_em",
        )
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + POR_PAGINA - 1);
      if (termo) {
        const t = termo.replace(/[%,()]/g, " ");
        q = q.or(`peca.ilike.%${t}%,modelo.ilike.%${t}%,fornecedor_nome.ilike.%${t}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (ultima, todas) =>
      ultima.length === POR_PAGINA ? todas.length * POR_PAGINA : undefined,
  });
  const linhas = consultas.data?.pages.flat() ?? [];

  const atualizar = useMutation({
    mutationFn: async (v: { id: string; status: StatusConsulta }) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from("fornecedor_consultas_pecas")
        .update(
          v.status === "respondida"
            ? { status: v.status, respondida_em: agora }
            : { status: v.status, conversa_aberta_em: agora },
        )
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedor-consultas-pecas"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Histórico de consultas de peças
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            “Resposta recebida” é marcada por você quando o fornecedor responder.
          </p>
        </DialogHeader>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por peça, modelo ou fornecedor..."
        />
        <div className="divide-y divide-border rounded-xl border border-border">
          {linhas.map((c) => {
            const status = (c.status as StatusConsulta) ?? "preparada";
            const aparelho = [c.marca, c.modelo].filter(Boolean).join(" ");
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">
                    {[c.peca, c.qualidade].filter(Boolean).join(" ")} · {aparelho}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.fornecedor_nome} · {formatarTelefone(c.whatsapp)} · {dataHora(c.created_at)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR[status]}`}>
                  {STATUS_CONSULTA_LABEL[status]}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      window.open(
                        linkConsultaWhatsapp(c.whatsapp, c.mensagem),
                        "_blank",
                        "noopener,noreferrer",
                      );
                      if (status === "preparada")
                        atualizar.mutate({ id: c.id, status: "conversa_aberta" });
                    }}
                  >
                    <MessageCircle className="h-4 w-4" /> Abrir
                  </Button>
                  {status !== "respondida" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={atualizar.isPending}
                      onClick={() => atualizar.mutate({ id: c.id, status: "respondida" })}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Respondeu
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {consultas.isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!consultas.isLoading && !linhas.length && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {consultas.isError
                ? "Não foi possível carregar o histórico."
                : "Nenhuma consulta registrada ainda."}
            </p>
          )}
        </div>
        {consultas.hasNextPage && (
          <Button
            variant="outline"
            onClick={() => consultas.fetchNextPage()}
            disabled={consultas.isFetchingNextPage}
          >
            {consultas.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
