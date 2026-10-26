import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronRight,
  ClipboardList,
  History,
  Link2,
  Loader2,
  Lock,
  RotateCcw,
  Unlink,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClienteSelect } from "@/components/ClienteSelect";
import { IconeWhatsapp } from "@/components/SuporteWhatsapp";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { STATUS_OS_COR, brl, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  type AcaoConversa,
  acaoConversaFn,
  contextoConversaFn,
  obterConversaFn,
} from "@/lib/whatsapp/central.functions";
import type { Conversa, ContextoConversa, Membro, OsResumo } from "@/lib/whatsapp/central.server";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { ACOES_OS, useAcoesOs } from "./AcoesOs";
import { OS_FINALIZADAS, QK, iniciais, mensagemDeErro } from "./util";

export type AcessoCentral = {
  euId: string;
  supervisor: boolean;
  podeResponder: boolean;
  verOrdens: boolean;
  equipe: Membro[];
  maxAnexoMb: number;
};

/** Conversa + contexto (cliente, OS, eventos) + ações, compartilhados pelas seções. */
export function useDadosConversa(conversaId: string) {
  const qc = useQueryClient();
  const conversa = useQuery({
    queryKey: QK.conversa(conversaId),
    queryFn: () => obterConversaFn({ data: { conversaId } }),
    // Tempo real por consulta curta: dono, status e não lidas.
    refetchInterval: 5000,
  });
  const ctx = useQuery({
    queryKey: QK.contexto(conversaId),
    queryFn: () => contextoConversaFn({ data: { conversaId } }),
    refetchInterval: 30_000,
  });
  const acao = useMutation({
    mutationFn: (dados: AcaoConversa) => acaoConversaFn({ data: dados }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["whatsapp-central"] }),
    onError: (e) => toast.error(mensagemDeErro(e)),
  });
  return {
    conversa: conversa.data,
    ctx: ctx.data,
    carregando: ctx.isLoading || conversa.isLoading,
    acao,
  };
}

type Dados = ReturnType<typeof useDadosConversa>;

function Titulo({
  icon: Icon,
  children,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-bold">{children}</h3>
      {extra && <div className="ml-auto">{extra}</div>}
    </div>
  );
}

function SeloOs({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
        STATUS_OS_COR[status as keyof typeof STATUS_OS_COR] ??
          "border-border bg-secondary text-muted-foreground",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

// ---------------------------------------------------------------------

export function SecaoCliente({
  conversaId,
  dados,
  podeResponder,
}: {
  conversaId: string;
  dados: Dados;
  podeResponder: boolean;
}) {
  const empresaId = useEmpresaId();
  const [escolhendo, setEscolhendo] = useState(false);
  const { conversa: c, ctx, acao } = dados;
  const clientes = useQuery({
    queryKey: ["clientes-select", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .eq("user_id", empresaId!)
        .order("nome")
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: escolhendo && !!empresaId,
  });
  if (!c) return null;
  const cliente = ctx?.cliente;
  const nome = cliente?.nome || c.contact_name || formatarTelefone(c.phone_number);

  return (
    <section>
      <Titulo
        icon={UserRound}
        extra={
          cliente && (
            <Link
              to="/clientes"
              search={{ busca: cliente.nome }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver cadastro
            </Link>
          )
        }
      >
        Dados do cliente
      </Titulo>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
          {iniciais(nome)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{nome}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {formatarTelefone(c.phone_number)}
            <IconeWhatsapp className="h-3.5 w-3.5 text-emerald-500" aria-label="WhatsApp" />
          </p>
          {cliente?.email && (
            <p className="truncate text-xs text-muted-foreground">{cliente.email}</p>
          )}
        </div>
      </div>
      {cliente && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            Cliente desde {new Date(cliente.created_at).getFullYear()}
          </span>
          {podeResponder && (
            <button
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => acao.mutate({ acao: "vincular", conversaId, clienteId: null })}
            >
              <Unlink className="h-3 w-3" /> Desvincular
            </button>
          )}
        </div>
      )}

      {!cliente && (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            {ctx?.candidatos.length
              ? ctx.candidatos.length > 1
                ? "Mais de um cliente com este telefone. Confirme qual é:"
                : "Encontramos um cliente com este telefone:"
              : "Nenhum cliente cadastrado com este telefone."}
          </p>
          {ctx?.candidatos.map((cand) => (
            <div key={cand.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{cand.nome}</span>
              {podeResponder && (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => acao.mutate({ acao: "vincular", conversaId, clienteId: cand.id })}
                  disabled={acao.isPending}
                >
                  <Link2 className="mr-1 h-3 w-3" /> Vincular
                </Button>
              )}
            </div>
          ))}
          {podeResponder &&
            (escolhendo ? (
              clientes.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClienteSelect
                  clientes={clientes.data ?? []}
                  value=""
                  semClienteLabel="Escolha o cliente"
                  onChange={(id) => {
                    if (id) acao.mutate({ acao: "vincular", conversaId, clienteId: id });
                    setEscolhendo(false);
                  }}
                />
              )
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEscolhendo(true)}
              >
                Vincular a um cliente
              </Button>
            ))}
        </div>
      )}
    </section>
  );
}

export function SecaoHistorico({ ctx }: { ctx: ContextoConversa | undefined }) {
  if (!ctx?.cliente || !ctx.ordens.length) return null;
  return (
    <section>
      <Titulo icon={History}>Histórico de atendimentos</Titulo>
      <ol className="relative space-y-3 border-l border-border pl-4">
        {ctx.ordens.map((os) => (
          <li key={os.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="text-xs text-muted-foreground">
              {dataCurta(os.created_at)} ·{" "}
              <span className="font-semibold text-foreground">OS #{os.numero}</span>
            </p>
            <div className="mt-0.5">
              <SeloOs status={os.status} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CartaoOs({ os }: { os: OsResumo }) {
  return (
    <Link
      to="/ordens"
      search={{ os: os.id }}
      className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">OS #{os.numero}</span>
          <SeloOs status={os.status} />
        </div>
        <p className="truncate text-xs">
          {[os.aparelho, os.marca, os.modelo].filter(Boolean).join(" ") || "Aparelho não informado"}
          {os.defeito ? ` · ${os.defeito}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Abertura: {dataCurta(os.created_at)}
          {os.valor != null && Number(os.valor) > 0 ? ` · ${brl(os.valor)}` : ""}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function SecaoOrdens({
  ctx,
  verOrdens,
}: {
  ctx: ContextoConversa | undefined;
  verOrdens: boolean;
}) {
  if (!verOrdens || !ctx?.cliente) return null;
  const emAndamento = ctx.ordens.filter((o) => !OS_FINALIZADAS.has(o.status));
  const lista = emAndamento.length ? emAndamento : ctx.ordens.slice(0, 2);
  return (
    <section>
      <Titulo
        icon={Wrench}
        extra={
          <Link to="/ordens" className="text-xs font-semibold text-primary hover:underline">
            Ver todas
          </Link>
        }
      >
        Ordens de serviço ({ctx.ordens.length})
      </Titulo>
      {lista.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma OS para este cliente.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((os) => (
            <CartaoOs key={os.id} os={os} />
          ))}
        </div>
      )}
    </section>
  );
}

export function SecaoAcoesRapidas({
  conversa,
  ctx,
  podeResponder,
  verOrdens,
}: {
  conversa: Conversa | undefined;
  ctx: ContextoConversa | undefined;
  podeResponder: boolean;
  verOrdens: boolean;
}) {
  const abrir = useAcoesOs();
  if (!podeResponder || !verOrdens || !conversa || !ctx?.cliente) return null;
  // Ações valem para a OS em andamento mais recente (ou a última, se todas terminaram).
  const alvo = ctx.ordens.find((o) => !OS_FINALIZADAS.has(o.status)) ?? ctx.ordens[0];
  if (!alvo) return null;
  return (
    <section>
      <Titulo
        icon={Zap}
        extra={<span className="text-[11px] text-muted-foreground">OS #{alvo.numero}</span>}
      >
        Ações rápidas
      </Titulo>
      <div className="space-y-1.5">
        {ACOES_OS.map((a) => (
          <button
            key={a.id}
            onClick={() =>
              abrir(alvo, a.id, {
                nome: ctx.cliente?.nome ?? null,
                telefone: formatarTelefone(conversa.phone_number),
              })
            }
            className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <a.icon className="h-4 w-4 text-primary" />
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function SecaoStatus({
  conversaId,
  dados,
  acesso,
}: {
  conversaId: string;
  dados: Dados;
  acesso: AcessoCentral;
}) {
  const { conversa: c, acao } = dados;
  if (!c || !acesso.podeResponder) return null;
  const comOutro = !!c.atribuida_a && c.atribuida_a !== acesso.euId && !acesso.supervisor;
  const encerrada = c.status === "encerrada";
  return (
    <section>
      <Titulo icon={ClipboardList}>Status da conversa</Titulo>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant={encerrada ? "outline" : "default"}
          disabled={!encerrada || comOutro || acao.isPending}
          onClick={() => acao.mutate({ acao: "reabrir", conversaId })}
        >
          {encerrada && <RotateCcw className="mr-1 h-3.5 w-3.5" />}
          {encerrada ? "Reabrir" : c.status === "aguardando" ? "Aguardando" : "Aberta"}
        </Button>
        {!comOutro && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                Transferir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel>Transferir para</DropdownMenuLabel>
              {acesso.equipe
                .filter((m) => m.podeAtender && m.id !== c.atribuida_a)
                .map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => acao.mutate({ acao: "transferir", conversaId, paraId: m.id })}
                  >
                    {m.id === acesso.euId ? "Você" : m.nome}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!encerrada && !comOutro && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-500"
            onClick={() => acao.mutate({ acao: "encerrar", conversaId })}
            disabled={acao.isPending}
          >
            <Lock className="mr-1 h-3.5 w-3.5" /> Encerrar
          </Button>
        )}
      </div>
    </section>
  );
}

export function SecaoDetalhes({
  conversaId,
  dados,
  podeResponder,
}: {
  conversaId: string;
  dados: Dados;
  podeResponder: boolean;
}) {
  const { conversa: c, ctx, acao } = dados;
  const [etiquetaNova, setEtiquetaNova] = useState("");
  if (!c) return null;

  function adicionarEtiqueta() {
    const nova = etiquetaNova.trim();
    if (!nova || !c) return;
    acao.mutate({ acao: "detalhes", conversaId, etiquetas: [...new Set([...c.etiquetas, nova])] });
    setEtiquetaNova("");
  }

  return (
    <section className="space-y-3">
      {podeResponder && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade</Label>
            <Select
              value={c.prioridade}
              onValueChange={(v) =>
                acao.mutate({
                  acao: "detalhes",
                  conversaId,
                  prioridade: v as "baixa" | "normal" | "alta",
                })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor={`etiqueta-${conversaId}`}>
              Etiquetas
            </Label>
            {c.etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {c.etiquetas.map((e) => (
                  <button
                    key={e}
                    className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:line-through"
                    title="Remover etiqueta"
                    onClick={() =>
                      acao.mutate({
                        acao: "detalhes",
                        conversaId,
                        etiquetas: c.etiquetas.filter((x) => x !== e),
                      })
                    }
                  >
                    {e} ×
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <Input
                id={`etiqueta-${conversaId}`}
                value={etiquetaNova}
                onChange={(e) => setEtiquetaNova(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && adicionarEtiqueta()}
                placeholder="Ex.: orçamento, garantia"
                maxLength={30}
                className="h-8"
              />
              <Button size="sm" variant="outline" className="h-8" onClick={adicionarEtiqueta}>
                Adicionar
              </Button>
            </div>
          </div>
        </>
      )}
      {!!ctx?.eventos.length && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
            Registro do atendimento
          </p>
          <ul className="space-y-1">
            {ctx.eventos.map((e, i) => (
              <li key={i} className="flex gap-2 text-[11px]">
                <span className="shrink-0 text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{e.descricao}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Coluna da direita (telas largas): todas as seções, na ordem do layout. */
export function PainelContexto({
  conversaId,
  acesso,
}: {
  conversaId: string;
  acesso: AcessoCentral;
}) {
  const dados = useDadosConversa(conversaId);
  if (dados.carregando) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="space-y-5 p-4 text-sm">
      <SecaoCliente conversaId={conversaId} dados={dados} podeResponder={acesso.podeResponder} />
      <SecaoHistorico ctx={dados.ctx} />
      <SecaoOrdens ctx={dados.ctx} verOrdens={acesso.verOrdens} />
      <SecaoAcoesRapidas
        conversa={dados.conversa}
        ctx={dados.ctx}
        podeResponder={acesso.podeResponder}
        verOrdens={acesso.verOrdens}
      />
      <SecaoStatus conversaId={conversaId} dados={dados} acesso={acesso} />
      <SecaoDetalhes conversaId={conversaId} dados={dados} podeResponder={acesso.podeResponder} />
    </div>
  );
}
