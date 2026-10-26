import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2, MessageSquare, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listarConversasFn } from "@/lib/whatsapp/central.functions";
import type { Conversa, FiltroConversa, Membro } from "@/lib/whatsapp/central.server";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { QK, horaCurta, iniciais, nomeMembro } from "./util";

const FILTROS: { id: FiltroConversa; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "nao_lidas", label: "Não lidas" },
  { id: "abertas", label: "Abertas" },
  { id: "aguardando", label: "Aguardando" },
  { id: "minhas", label: "Minhas" },
  { id: "encerradas", label: "Encerradas" },
];

export function ListaConversas({
  selecionada,
  onSelecionar,
  equipe,
  euId,
}: {
  selecionada: string | null;
  onSelecionar: (id: string) => void;
  equipe: Membro[] | undefined;
  euId: string | undefined;
}) {
  const [filtro, setFiltro] = useState<FiltroConversa>("todas");
  const [digitado, setDigitado] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setBusca(digitado.trim()), 350);
    return () => clearTimeout(t);
  }, [digitado]);

  const consulta = useInfiniteQuery({
    queryKey: QK.conversas(filtro, busca),
    queryFn: ({ pageParam }) => listarConversasFn({ data: { filtro, busca, antesDe: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.proximo,
    // Tempo real por consulta curta: só a primeira página volta a cada 5 s.
    refetchInterval: 5000,
    placeholderData: (anterior) => anterior,
  });

  const conversas = consulta.data?.pages.flatMap((p) => p.conversas) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={digitado}
            onChange={(e) => setDigitado(e.target.value)}
            placeholder="Nome, telefone ou mensagem"
            className="pl-9"
            aria-label="Pesquisar conversas"
          />
        </div>
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Filtrar conversas"
        >
          {FILTROS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filtro === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {consulta.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversas…
          </div>
        ) : consulta.isError ? (
          <p className="p-6 text-sm text-destructive">
            {consulta.error instanceof Error
              ? consulta.error.message
              : "Erro ao carregar conversas."}
          </p>
        ) : conversas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            {busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa neste filtro."}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {conversas.map((c) => (
              <li key={c.id}>
                <ItemConversa
                  conversa={c}
                  ativa={c.id === selecionada}
                  atendente={c.atribuida_a === euId ? "Você" : nomeMembro(equipe, c.atribuida_a)}
                  onClick={() => onSelecionar(c.id)}
                />
              </li>
            ))}
          </ul>
        )}
        {consulta.hasNextPage && (
          <div className="p-3">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => consulta.fetchNextPage()}
              disabled={consulta.isFetchingNextPage}
            >
              {consulta.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Carregar mais
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemConversa({
  conversa: c,
  ativa,
  atendente,
  onClick,
}: {
  conversa: Conversa;
  ativa: boolean;
  atendente: string | null;
  onClick: () => void;
}) {
  const nome = c.cliente_nome || c.contact_name || formatarTelefone(c.phone_number);
  return (
    <button
      onClick={onClick}
      aria-current={ativa ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 px-3 py-3 text-left transition-colors focus-visible:bg-accent focus-visible:outline-none",
        ativa ? "bg-primary/10" : "hover:bg-accent/60",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          c.cliente_id ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
        )}
        aria-hidden
      >
        {c.cliente_nome || c.contact_name ? iniciais(nome) : <UserRound className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={cn("truncate text-sm", c.nao_lidas ? "font-bold" : "font-semibold")}>
            {nome}
          </span>
          <span
            className={cn(
              "ml-auto shrink-0 text-[11px]",
              c.nao_lidas ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {horaCurta(c.ultima_mensagem_em)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
            {c.ultima_direcao === "outbound" && (
              <ArrowUpRight className="h-3 w-3 shrink-0" aria-label="Enviada" />
            )}
            <span className="truncate">{c.ultima_mensagem_preview || "—"}</span>
          </span>
          {c.nao_lidas > 0 && (
            <span
              className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground"
              aria-label={`${c.nao_lidas} não lidas`}
            >
              {c.nao_lidas}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {c.status === "encerrada" && <Etiqueta tom="neutro">Encerrada</Etiqueta>}
          {c.status === "aguardando" && <Etiqueta tom="neutro">Aguardando cliente</Etiqueta>}
          {c.prioridade === "alta" && <Etiqueta tom="alerta">Prioridade alta</Etiqueta>}
          {atendente && <Etiqueta tom="roxo">{atendente}</Etiqueta>}
          {c.etiquetas.slice(0, 2).map((e) => (
            <Etiqueta key={e} tom="neutro">
              {e}
            </Etiqueta>
          ))}
        </div>
      </div>
    </button>
  );
}

function Etiqueta({
  children,
  tom,
}: {
  children: React.ReactNode;
  tom: "neutro" | "alerta" | "roxo";
}) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        tom === "neutro" && "bg-secondary text-muted-foreground",
        tom === "alerta" && "bg-red-500/10 text-red-600",
        tom === "roxo" && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}
