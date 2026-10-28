import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Bot,
  CalendarClock,
  Check,
  CheckCheck,
  Clock,
  Download,
  FileText,
  Hand,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Paperclip,
  Plus,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
  UserRoundX,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  enviarAnexoFn,
  enviarTextoFn,
  linkAnexoFn,
  listarArquivosFn,
  listarAutomacoesFn,
  listarMensagensFn,
  marcarLidaFn,
  reenviarTextoFn,
  respostasRapidasFn,
  sugestaoIAFn,
} from "@/lib/whatsapp/central.functions";
import type { ContextoConversa, Conversa, MensagemCentral } from "@/lib/whatsapp/central.server";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { useAcoesOs, type AcaoOs } from "./AcoesOs";
import { Avatar } from "./Avatar";
import { RespostasRapidasDialog } from "./RespostasRapidasDialog";
import {
  type AcessoCentral,
  SecaoAcoesRapidas,
  SecaoCliente,
  SecaoDetalhes,
  SecaoHistorico,
  SecaoOrdens,
  SecaoStatus,
  useDadosConversa,
} from "./PainelContexto";
import {
  OS_FINALIZADAS,
  QK,
  iniciais,
  lerComoBase64,
  mensagemDeErro,
  nomeMembro,
  rotuloDia,
  tamanhoArquivo,
} from "./util";

type Aba = "conversa" | "cliente" | "os" | "arquivos" | "automacao";

const ABAS: { id: Aba; label: string }[] = [
  { id: "conversa", label: "Conversa" },
  { id: "cliente", label: "Cliente" },
  { id: "os", label: "OS" },
  { id: "arquivos", label: "Arquivos" },
  { id: "automacao", label: "Automação" },
];

export function JanelaConversa({
  conversaId,
  acesso,
  onVoltar,
}: {
  conversaId: string;
  acesso: AcessoCentral;
  onVoltar: () => void;
}) {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("conversa");
  const dados = useDadosConversa(conversaId);
  const conversa = dados.conversa;

  const naoLidas = conversa?.nao_lidas ?? 0;
  // Abriu a conversa (ou chegou mensagem com ela aberta): zera não lidas.
  useEffect(() => {
    if (naoLidas > 0) {
      void marcarLidaFn({ data: { conversaId } }).then(() => {
        void qc.invalidateQueries({ queryKey: ["whatsapp-central", "nao-lidas"] });
        void qc.invalidateQueries({ queryKey: QK.filtros });
      });
    }
  }, [conversaId, naoLidas, qc]);

  const comOutro =
    !!conversa?.atribuida_a && conversa.atribuida_a !== acesso.euId && !acesso.supervisor;
  const dono =
    conversa?.atribuida_a === acesso.euId
      ? "você"
      : nomeMembro(acesso.equipe, conversa?.atribuida_a ?? null);
  const nome =
    conversa?.cliente_nome ||
    conversa?.contact_name ||
    (conversa ? formatarTelefone(conversa.phone_number) : "");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onVoltar}
          aria-label="Voltar para a lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Avatar nome={nome} foto={conversa?.foto_url} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{nome || "…"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversa ? formatarTelefone(conversa.phone_number) : ""}
          </p>
        </div>
        {conversa && (
          <span
            className={cn(
              "hidden shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold sm:inline",
              conversa.atribuida_a
                ? "bg-primary/15 text-primary"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {conversa.atribuida_a ? `Atribuído a ${dono}` : "Sem responsável"}
          </span>
        )}
        {acesso.podeResponder && conversa && !conversa.atribuida_a && (
          <Button
            size="sm"
            onClick={() => dados.acao.mutate({ acao: "assumir", conversaId })}
            disabled={dados.acao.isPending}
          >
            <Hand className="mr-1.5 h-4 w-4" /> Assumir
          </Button>
        )}
        {acesso.podeResponder && conversa && (conversa.atribuida_a ? !comOutro : false) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Mais ações">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {conversa.atribuida_a !== acesso.euId && (
                <DropdownMenuItem
                  onClick={() => dados.acao.mutate({ acao: "assumir", conversaId })}
                >
                  <Hand className="mr-2 h-4 w-4" /> Assumir conversa
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => dados.acao.mutate({ acao: "liberar", conversaId })}>
                <UserRoundX className="mr-2 h-4 w-4" /> Liberar (sem responsável)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Abas */}
      <div
        className="flex gap-1 overflow-x-auto border-b border-border px-2 sm:px-3"
        role="tablist"
      >
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              aba === a.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === "conversa" ? (
        <AbaConversa
          conversaId={conversaId}
          conversa={conversa}
          ctx={dados.ctx}
          acesso={acesso}
          comOutro={comOutro}
          dono={dono}
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
          {aba === "cliente" && (
            <>
              <SecaoCliente
                conversaId={conversaId}
                dados={dados}
                podeResponder={acesso.podeResponder}
              />
              <SecaoHistorico ctx={dados.ctx} />
              <SecaoStatus conversaId={conversaId} dados={dados} acesso={acesso} />
              <SecaoDetalhes
                conversaId={conversaId}
                dados={dados}
                podeResponder={acesso.podeResponder}
              />
            </>
          )}
          {aba === "os" &&
            (acesso.verOrdens ? (
              dados.ctx?.cliente ? (
                <>
                  <SecaoOrdens ctx={dados.ctx} verOrdens />
                  <SecaoAcoesRapidas
                    conversa={conversa}
                    ctx={dados.ctx}
                    podeResponder={acesso.podeResponder}
                    verOrdens
                  />
                </>
              ) : (
                <p className="text-muted-foreground">
                  Vincule a conversa a um cliente (aba Cliente) para ver as OS.
                </p>
              )
            ) : (
              <p className="text-muted-foreground">
                Seu usuário não tem acesso às ordens de serviço.
              </p>
            ))}
          {aba === "arquivos" && <AbaArquivos conversaId={conversaId} />}
          {aba === "automacao" && <AbaAutomacao conversaId={conversaId} />}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function AbaConversa({
  conversaId,
  conversa,
  ctx,
  acesso,
  comOutro,
  dono,
}: {
  conversaId: string;
  conversa: Conversa | undefined;
  ctx: ContextoConversa | undefined;
  acesso: AcessoCentral;
  comOutro: boolean;
  dono: string | null;
}) {
  const qc = useQueryClient();
  const mensagensQ = useInfiniteQuery({
    queryKey: QK.mensagens(conversaId),
    queryFn: ({ pageParam }) => listarMensagensFn({ data: { conversaId, antesDe: pageParam } }),
    initialPageParam: null as string | null,
    getNextPageParam: (pagina) =>
      pagina.temMais ? (pagina.mensagens[0]?.created_at ?? null) : null,
    refetchInterval: 4000,
  });

  // Páginas chegam da mais nova para a mais antiga; na tela é o contrário.
  const mensagens = useMemo(
    () => [...(mensagensQ.data?.pages ?? [])].reverse().flatMap((p) => p.mensagens),
    [mensagensQ.data],
  );
  const ultima = mensagens.at(-1);

  // Rola para o fim quando chega mensagem nova (não ao carregar antigas).
  const fimRef = useRef<HTMLDivElement>(null);
  const ultimaIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (ultima && ultima.id !== ultimaIdRef.current) {
      fimRef.current?.scrollIntoView({ block: "end" });
      ultimaIdRef.current = ultima.id;
    }
  }, [ultima]);

  function atualizar() {
    void qc.invalidateQueries({ queryKey: ["whatsapp-central"] });
  }

  const podeMexer = acesso.podeResponder && !comOutro;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
        {mensagensQ.hasNextPage && (
          <div className="mb-3 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mensagensQ.fetchNextPage()}
              disabled={mensagensQ.isFetchingNextPage}
            >
              {mensagensQ.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mensagens anteriores
            </Button>
          </div>
        )}
        {mensagensQ.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          mensagens.map((m, i) => {
            const anterior = mensagens[i - 1];
            const novoDia =
              !anterior ||
              new Date(anterior.created_at).toDateString() !==
                new Date(m.created_at).toDateString();
            return (
              <Fragment key={m.id}>
                {novoDia && (
                  <div className="my-4 text-center">
                    <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      {rotuloDia(m.created_at)}
                    </span>
                  </div>
                )}
                <Bolha
                  m={m}
                  autor={m.sent_by === acesso.euId ? "Você" : nomeMembro(acesso.equipe, m.sent_by)}
                  podeReenviar={podeMexer}
                  onReenviado={atualizar}
                />
              </Fragment>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {!acesso.podeResponder ? (
        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          Seu usuário pode acompanhar as conversas, mas não responder.
        </p>
      ) : comOutro ? (
        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
          Esta conversa está com <strong>{dono}</strong>. Peça a transferência para responder.
        </p>
      ) : (
        <Composer
          conversaId={conversaId}
          conversa={conversa}
          ctx={ctx}
          verOrdens={acesso.verOrdens}
          vistoAte={ultima?.created_at ?? null}
          maxAnexoMb={acesso.maxAnexoMb}
          onEnviado={atualizar}
        />
      )}
    </>
  );
}

function IconeStatus({ m, claro }: { m: MensagemCentral; claro: boolean }) {
  const base = claro ? "text-white/80" : "text-muted-foreground";
  if (m.status === "falhou")
    return <AlertCircle className="h-3.5 w-3.5 text-red-400" aria-label="Falhou" />;
  if (m.status === "pendente")
    return <Clock className={cn("h-3.5 w-3.5", base)} aria-label="Enviando" />;
  if (m.status === "agendado")
    return <CalendarClock className={cn("h-3.5 w-3.5", base)} aria-label="Agendada" />;
  if (m.status === "cancelado")
    return <Ban className={cn("h-3.5 w-3.5", base)} aria-label="Cancelada" />;
  if (m.entrega === "lido")
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Lida" />;
  if (m.entrega === "entregue")
    return <CheckCheck className={cn("h-3.5 w-3.5", base)} aria-label="Entregue" />;
  return <Check className={cn("h-3.5 w-3.5", base)} aria-label="Enviada" />;
}

function Bolha({
  m,
  autor,
  podeReenviar,
  onReenviado,
}: {
  m: MensagemCentral;
  autor: string | null;
  podeReenviar: boolean;
  onReenviado: () => void;
}) {
  const saida = m.direction === "outbound";
  const automatica = saida && m.origem === "automatica";
  const roxa = saida && !automatica && m.status !== "falhou";
  const reenviar = useMutation({
    mutationFn: () => reenviarTextoFn({ data: { mensagemId: m.id } }),
    onSuccess: () => {
      toast.success("Mensagem reenviada.");
      onReenviado();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className={cn("mb-2.5 flex", saida ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[70%]",
          !saida && "rounded-bl-md border border-border bg-secondary",
          roxa && "rounded-br-md bg-primary text-primary-foreground",
          automatica && "rounded-br-md border border-emerald-500/40 bg-emerald-500/10",
          saida && m.status === "falhou" && "rounded-br-md border border-red-500/40 bg-red-500/10",
        )}
      >
        {automatica && (
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
            <Bot className="h-3.5 w-3.5" />{" "}
            {m.template_id?.startsWith("robo_") ? "Robô de atendimento" : "Mensagem automática"}
          </p>
        )}
        {saida && m.origem === "celular" && (
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
            <Smartphone className="h-3 w-3" /> Pelo celular
          </p>
        )}
        {m.resposta_a && (
          <div
            className={cn(
              "mb-1.5 rounded-md border-l-2 px-2 py-1 text-xs",
              roxa
                ? "border-white/60 bg-white/10"
                : "border-primary/60 bg-background/50 text-muted-foreground",
            )}
          >
            {m.resposta_a_texto ? m.resposta_a_texto.slice(0, 160) : "Mensagem anterior"}
          </div>
        )}
        {m.midia_tipo && <Anexo m={m} />}
        {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1.5 text-[10px]",
            roxa ? "text-white/75" : "text-muted-foreground",
          )}
        >
          {saida && autor && <span>{autor} ·</span>}
          <span>
            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {saida && <IconeStatus m={m} claro={roxa} />}
        </div>
        {m.status === "falhou" && (
          <div className="mt-1.5 space-y-1">
            {m.error && <p className="text-[11px] text-red-500">{m.error.slice(0, 200)}</p>}
            {podeReenviar && m.content && !m.midia_tipo && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => reenviar.mutate()}
                disabled={reenviar.isPending}
              >
                {reenviar.isPending ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1 h-3 w-3" />
                )}
                Tentar de novo
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

async function abrirAnexo(mensagemId: string) {
  try {
    const { url } = await linkAnexoFn({ data: { mensagemId } });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    toast.error(mensagemDeErro(e));
  }
}

function Anexo({ m }: { m: MensagemCentral }) {
  const ehImagem = m.midia_tipo === "imagem" || m.midia_tipo === "figurinha";
  const link = useQuery({
    queryKey: ["whatsapp-central", "anexo", m.id],
    queryFn: () => linkAnexoFn({ data: { mensagemId: m.id } }),
    enabled: ehImagem && m.tem_midia,
    staleTime: 4 * 60_000,
  });
  const [baixando, setBaixando] = useState(false);

  if (!m.tem_midia) {
    return (
      <p className="mb-1 flex items-center gap-1.5 text-xs italic opacity-80">
        <FileText className="h-3.5 w-3.5" /> {m.midia_nome || `Arquivo (${m.midia_tipo})`} — não
        disponível
      </p>
    );
  }

  if (ehImagem) {
    return link.data ? (
      <a href={link.data.url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
        <img
          src={link.data.url}
          alt={m.midia_nome ?? "Imagem"}
          className="max-h-72 rounded-lg object-contain"
          loading="lazy"
        />
      </a>
    ) : (
      <div className="mb-1 flex h-32 w-48 items-center justify-center rounded-lg bg-black/10">
        <Loader2 className="h-4 w-4 animate-spin opacity-70" />
      </div>
    );
  }

  return (
    <button
      onClick={async () => {
        setBaixando(true);
        await abrirAnexo(m.id);
        setBaixando(false);
      }}
      disabled={baixando}
      className="mb-1 flex w-full items-center gap-2 rounded-lg border border-current/20 bg-black/10 px-2.5 py-2 text-left hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{m.midia_nome || "Arquivo"}</span>
        <span className="text-[10px] opacity-75">{tamanhoArquivo(m.midia_tamanho)}</span>
      </span>
      {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  );
}

// ---------------------------------------------------------------------

function AbaArquivos({ conversaId }: { conversaId: string }) {
  const q = useQuery({
    queryKey: QK.arquivos(conversaId),
    queryFn: () => listarArquivosFn({ data: { conversaId } }),
  });
  if (q.isLoading)
    return <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />;
  if (!q.data?.length)
    return <p className="text-muted-foreground">Nenhum arquivo nesta conversa.</p>;
  return (
    <ul className="space-y-2">
      {q.data.map((a) => (
        <li key={a.id}>
          <button
            onClick={() => abrirAnexo(a.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left hover:border-primary/50 hover:bg-primary/5"
          >
            {a.midia_tipo === "imagem" ? (
              <ImageIcon className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.midia_nome || a.midia_tipo}</span>
              <span className="text-xs text-muted-foreground">
                {a.direction === "inbound" ? "Recebido" : "Enviado"} ·{" "}
                {new Date(a.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {tamanhoArquivo(a.midia_tamanho)}
              </span>
            </span>
            <Download className="h-4 w-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const NOME_MODELO: Record<string, string> = {
  os_pronta: "OS pronta",
  pesquisa_pos_os: "Pesquisa pós-OS",
  pesquisa_pos_venda: "Pesquisa pós-venda",
  aniversario: "Aniversário",
  boas_vindas: "Boas-vindas",
};

function nomeAutomacao(templateId: string | null): string {
  if (!templateId) return "Mensagem automática";
  const chave = Object.keys(NOME_MODELO).find((k) => templateId.startsWith(k));
  return chave ? NOME_MODELO[chave]! : templateId.replace(/_/g, " ");
}

const STATUS_AUTOMACAO: Record<string, string> = {
  enviado: "Enviada",
  agendado: "Na fila",
  pendente: "Enviando",
  falhou: "Falhou",
  cancelado: "Cancelada",
};

function AbaAutomacao({ conversaId }: { conversaId: string }) {
  const q = useQuery({
    queryKey: QK.automacoes(conversaId),
    queryFn: () => listarAutomacoesFn({ data: { conversaId } }),
  });
  if (q.isLoading)
    return <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Mensagens que o sistema enviou sozinho para este contato. Regras, horários e reenvios ficam
        em Fila e automações.
      </p>
      {!q.data?.length ? (
        <p className="text-muted-foreground">Nenhuma mensagem automática para este contato.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold">{nomeAutomacao(a.template_id)}</span>
                <span
                  className={cn(
                    "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    a.status === "falhou"
                      ? "bg-red-500/10 text-red-500"
                      : a.status === "enviado"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {STATUS_AUTOMACAO[a.status] ?? a.status}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(a.scheduled_at ?? a.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {a.error ? ` · ${a.error.slice(0, 120)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function Composer({
  conversaId,
  conversa,
  ctx,
  verOrdens,
  vistoAte,
  maxAnexoMb,
  onEnviado,
}: {
  conversaId: string;
  conversa: Conversa | undefined;
  ctx: ContextoConversa | undefined;
  verOrdens: boolean;
  vistoAte: string | null;
  maxAnexoMb: number;
  onEnviado: () => void;
}) {
  const abrirAcaoOs = useAcoesOs();
  const [texto, setTexto] = useState("");
  const [colisao, setColisao] = useState<null | (() => void)>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [resumo, setResumo] = useState<string | null>(null);
  const [modelosAbertos, setModelosAbertos] = useState(false);
  const [gerenciarModelos, setGerenciarModelos] = useState(false);
  const inputImagem = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nomeCliente = conversa?.cliente_nome ?? conversa?.contact_name ?? "";

  // Rascunho por conversa: trocar de conversa não mistura textos.
  useEffect(() => {
    setTexto("");
    setArquivo(null);
    setLegenda("");
  }, [conversaId]);

  const respostas = useQuery({
    queryKey: QK.respostas,
    queryFn: () => respostasRapidasFn(),
    staleTime: 60_000,
  });
  const filtroAtalho =
    texto.startsWith("/") && !texto.includes("\n") ? texto.slice(1).toLowerCase() : null;
  const listaModelos = modelosAbertos
    ? (respostas.data ?? [])
    : filtroAtalho !== null
      ? (respostas.data ?? []).filter((r) => r.atalho.startsWith(filtroAtalho)).slice(0, 6)
      : [];

  function aplicarResposta(t: string) {
    const primeiroNome = nomeCliente.trim().split(/\s+/)[0] ?? "";
    setTexto(t.replace(/\{nome\}/gi, primeiroNome));
    setModelosAbertos(false);
    textareaRef.current?.focus();
  }

  function tratarErro(e: unknown, repetir: () => void) {
    if (e instanceof Error && e.message.startsWith("COLISAO:")) {
      setColisao(() => repetir);
      return;
    }
    toast.error(mensagemDeErro(e));
  }

  const enviarTexto = useMutation({
    mutationFn: (forcar: boolean) =>
      enviarTextoFn({ data: { conversaId, texto: texto.trim(), vistoAte, forcar } }),
    onSuccess: () => {
      setTexto("");
      onEnviado();
    },
    onError: (e, forcar) => {
      onEnviado();
      // Falha do WhatsApp já ficou gravada na conversa, com "Tentar de novo".
      if (e instanceof Error && e.message.startsWith("Não foi enviada")) setTexto("");
      if (!forcar) tratarErro(e, () => enviarTexto.mutate(true));
      else toast.error(mensagemDeErro(e));
    },
  });

  const enviarArquivo = useMutation({
    mutationFn: async (forcar: boolean) => {
      if (!arquivo) return;
      const base64 = await lerComoBase64(arquivo);
      await enviarAnexoFn({
        data: { conversaId, nome: arquivo.name, base64, legenda, vistoAte, forcar },
      });
    },
    onSuccess: () => {
      setArquivo(null);
      setLegenda("");
      onEnviado();
    },
    onError: (e, forcar) => {
      onEnviado();
      if (!forcar) tratarErro(e, () => enviarArquivo.mutate(true));
      else toast.error(mensagemDeErro(e));
    },
  });

  const ia = useMutation({
    mutationFn: (modo: "responder" | "resumir") => sugestaoIAFn({ data: { conversaId, modo } }),
    onSuccess: (r, modo) => {
      if (modo === "resumir") setResumo(r.texto);
      else {
        setTexto(r.texto);
        textareaRef.current?.focus();
        toast.info("Sugestão da IA no campo de texto. Revise antes de enviar.");
      }
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  function escolherArquivo(f: File | undefined) {
    if (!f) return;
    if (f.size > maxAnexoMb * 1024 * 1024) {
      toast.error(`Arquivo maior que ${maxAnexoMb} MB.`);
      return;
    }
    setArquivo(f);
  }

  // Atalhos de OS (mesmas ações rápidas do painel) para a OS em andamento.
  const osAlvo =
    verOrdens && ctx?.cliente
      ? (ctx.ordens.find((o) => !OS_FINALIZADAS.has(o.status)) ?? ctx.ordens[0])
      : undefined;
  function acaoOs(acao: AcaoOs) {
    if (!osAlvo || !conversa) return;
    abrirAcaoOs(osAlvo, acao, {
      nome: ctx?.cliente?.nome ?? null,
      telefone: formatarTelefone(conversa.phone_number),
    });
  }

  const enviando = enviarTexto.isPending || enviarArquivo.isPending;
  const previa = useMemo(
    () => (arquivo?.type.startsWith("image/") ? URL.createObjectURL(arquivo) : null),
    [arquivo],
  );
  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa);
    },
    [previa],
  );

  const ferramenta =
    "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
  const chip =
    "flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50";

  return (
    <div className="relative border-t border-border p-2 sm:p-3">
      {modelosAbertos && listaModelos.length === 0 && !respostas.isLoading && (
        <div className="absolute bottom-full left-2 right-2 z-10 mb-1 rounded-xl border border-border bg-popover p-4 text-center shadow-lg">
          <p className="text-sm font-semibold">Nenhuma resposta rápida ainda</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Salve textos que você manda sempre (horário, endereço, formas de pagamento…) e use com
            um clique ou digitando / e o atalho.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => {
              setModelosAbertos(false);
              setGerenciarModelos(true);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Criar resposta rápida
          </Button>
        </div>
      )}

      {listaModelos.length > 0 && (
        <ul
          className="absolute bottom-full left-2 right-2 z-10 mb-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
          role="listbox"
          aria-label="Respostas rápidas"
        >
          {listaModelos.map((r) => (
            <li key={r.id}>
              <button
                role="option"
                aria-selected={false}
                className="w-full rounded-lg px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                onClick={() => aplicarResposta(r.texto)}
              >
                <span className="text-xs font-bold text-primary">/{r.atalho}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.texto}</span>
              </button>
            </li>
          ))}
          {modelosAbertos && (
            <li className="border-t border-border pt-1">
              <button
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-accent"
                onClick={() => {
                  setModelosAbertos(false);
                  setGerenciarModelos(true);
                }}
              >
                Gerenciar respostas rápidas…
              </button>
            </li>
          )}
        </ul>
      )}

      <RespostasRapidasDialog
        open={gerenciarModelos}
        onOpenChange={setGerenciarModelos}
        podeEditar
      />

      <input
        ref={inputImagem}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
        onChange={(e) => {
          escolherArquivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={inputArquivo}
        type="file"
        className="hidden"
        accept="application/pdf,.docx,.xlsx,audio/ogg,audio/mpeg,image/*"
        onChange={(e) => {
          escolherArquivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="mb-1.5 flex items-center gap-0.5">
        <button
          className={ferramenta}
          onClick={() => inputImagem.current?.click()}
          disabled={enviando}
          aria-label="Enviar foto ou vídeo"
          title="Foto ou vídeo"
        >
          <ImageIcon className="h-4 w-4" />
        </button>
        <button
          className={ferramenta}
          onClick={() => inputArquivo.current?.click()}
          disabled={enviando}
          aria-label="Enviar documento"
          title="Documento (PDF, Word, Excel)"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <button
          className={ferramenta}
          onClick={() => setModelosAbertos((v) => !v)}
          aria-label="Respostas rápidas"
          title="Respostas rápidas"
        >
          <Zap className="h-4 w-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          className={ferramenta}
          onClick={() => ia.mutate("responder")}
          disabled={ia.isPending}
          aria-label="Sugerir resposta com IA"
          title="Sugerir resposta com IA"
        >
          {ia.isPending && ia.variables === "responder" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </button>
        <button
          className={ferramenta}
          onClick={() => ia.mutate("resumir")}
          disabled={ia.isPending}
          aria-label="Resumir conversa com IA"
          title="Resumir conversa com IA"
        >
          {ia.isPending && ia.variables === "resumir" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="flex items-end gap-2 rounded-xl border border-border bg-background/50 p-1.5 focus-within:border-primary/60">
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (listaModelos[0] && filtroAtalho !== null) aplicarResposta(listaModelos[0].texto);
              else if (texto.trim() && !enviando) enviarTexto.mutate(false);
            }
            if (e.key === "Escape") setModelosAbertos(false);
          }}
          onPaste={(e) => {
            const f = e.clipboardData.files[0];
            if (f) {
              e.preventDefault();
              escolherArquivo(f);
            }
          }}
          placeholder="Digite sua mensagem…"
          rows={1}
          className="max-h-40 min-h-[40px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          aria-label="Mensagem"
        />
        <Button
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={() => enviarTexto.mutate(false)}
          disabled={!texto.trim() || enviando}
          aria-label="Enviar"
        >
          {enviarTexto.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className={chip} onClick={() => setModelosAbertos((v) => !v)}>
          <Zap className="h-3.5 w-3.5" /> Modelos
        </button>
        {osAlvo && (
          <>
            <button className={chip} onClick={() => acaoOs("orcamento")}>
              <FileText className="h-3.5 w-3.5" /> Orçamento
            </button>
            <button className={chip} onClick={() => acaoOs("atualizar")}>
              <RotateCcw className="h-3.5 w-3.5" /> Atualizar OS
            </button>
            <button className={chip} onClick={() => acaoOs("pronto")}>
              <Check className="h-3.5 w-3.5" /> Aparelho pronto
            </button>
          </>
        )}
        <button
          className={chip}
          onClick={() => inputArquivo.current?.click()}
          aria-label="Anexar arquivo"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog
        open={!!arquivo}
        onOpenChange={(o) => !o && !enviarArquivo.isPending && setArquivo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar arquivo</DialogTitle>
            <DialogDescription>
              {arquivo?.name} · {tamanhoArquivo(arquivo?.size ?? null)}
            </DialogDescription>
          </DialogHeader>
          {previa ? (
            <img
              src={previa}
              alt="Pré-visualização"
              className="max-h-72 w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <FileText className="h-8 w-8 text-primary" />
              <span className="truncate text-sm font-medium">{arquivo?.name}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="legenda-anexo">Legenda (opcional)</Label>
            <Input
              id="legenda-anexo"
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              maxLength={1024}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArquivo(null)}
              disabled={enviarArquivo.isPending}
            >
              <X className="mr-1.5 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={() => enviarArquivo.mutate(false)} disabled={enviarArquivo.isPending}>
              {enviarArquivo.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resumo !== null} onOpenChange={(o) => !o && setResumo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Resumo da conversa
            </DialogTitle>
            <DialogDescription>
              Gerado pela IA a partir das últimas mensagens. Confira antes de usar.
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm">{resumo}</p>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!colisao}
        onOpenChange={(o) => !o && setColisao(null)}
        title="Outro atendente acabou de responder"
        description="Alguém da equipe respondeu esta conversa depois da última mensagem que você viu. Confira a conversa antes. Enviar mesmo assim?"
        confirmLabel="Enviar mesmo assim"
        onConfirm={() => {
          colisao?.();
          setColisao(null);
        }}
      />
    </div>
  );
}
