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
  Loader2,
  Lock,
  MoreVertical,
  PanelRight,
  Paperclip,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
  UserRoundCheck,
  UserRoundX,
  X,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import {
  type AcaoConversa,
  acaoConversaFn,
  enviarAnexoFn,
  enviarTextoFn,
  linkAnexoFn,
  listarMensagensFn,
  marcarLidaFn,
  obterConversaFn,
  reenviarTextoFn,
  respostasRapidasFn,
  sugestaoIAFn,
} from "@/lib/whatsapp/central.functions";
import type { MensagemCentral, Membro } from "@/lib/whatsapp/central.server";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { QK, lerComoBase64, mensagemDeErro, nomeMembro, rotuloDia, tamanhoArquivo } from "./util";

type Acesso = {
  euId: string;
  supervisor: boolean;
  podeResponder: boolean;
  equipe: Membro[];
  maxAnexoMb: number;
};

export function JanelaConversa({
  conversaId,
  acesso,
  onVoltar,
  onAbrirPainel,
}: {
  conversaId: string;
  acesso: Acesso;
  onVoltar: () => void;
  onAbrirPainel: () => void;
}) {
  const qc = useQueryClient();

  const conversaQ = useQuery({
    queryKey: QK.conversa(conversaId),
    queryFn: () => obterConversaFn({ data: { conversaId } }),
    refetchInterval: 5000,
  });

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

  const conversa = conversaQ.data;
  const naoLidas = conversa?.nao_lidas ?? 0;

  // Abriu a conversa (ou chegou mensagem com ela aberta): zera não lidas.
  useEffect(() => {
    if (naoLidas > 0) {
      void marcarLidaFn({ data: { conversaId } }).then(() =>
        qc.invalidateQueries({ queryKey: ["whatsapp-central", "nao-lidas"] }),
      );
    }
  }, [conversaId, naoLidas, qc]);

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
    void qc.invalidateQueries({ queryKey: QK.mensagens(conversaId) });
    void qc.invalidateQueries({ queryKey: QK.conversa(conversaId) });
    void qc.invalidateQueries({ queryKey: QK.contexto(conversaId) });
    void qc.invalidateQueries({ queryKey: ["whatsapp-central", "conversas"] });
  }

  const acao = useMutation({
    mutationFn: (dados: AcaoConversa) => acaoConversaFn({ data: dados }),
    onSuccess: atualizar,
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const comOutro =
    !!conversa?.atribuida_a && conversa.atribuida_a !== acesso.euId && !acesso.supervisor;
  const dono =
    conversa?.atribuida_a === acesso.euId
      ? "Você"
      : nomeMembro(acesso.equipe, conversa?.atribuida_a ?? null);
  const podeMexer = acesso.podeResponder && !comOutro;
  const nome =
    conversa?.cliente_nome ||
    conversa?.contact_name ||
    (conversa ? formatarTelefone(conversa.phone_number) : "");

  if (conversaQ.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive" />
        {mensagemDeErro(conversaQ.error)}
        <Button variant="outline" onClick={onVoltar}>
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onVoltar}
          aria-label="Voltar para a lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{nome || "…"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversa ? formatarTelefone(conversa.phone_number) : ""}
            {dono ? ` · com ${dono}` : " · sem responsável"}
            {conversa?.status === "encerrada" ? " · encerrada" : ""}
          </p>
        </div>

        {acesso.podeResponder && conversa && !conversa.atribuida_a && (
          <Button
            size="sm"
            onClick={() => acao.mutate({ acao: "assumir", conversaId })}
            disabled={acao.isPending}
          >
            <Hand className="mr-1.5 h-4 w-4" /> Assumir
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          onClick={onAbrirPainel}
          aria-label="Dados do cliente e OS"
        >
          <PanelRight className="h-5 w-5" />
        </Button>
        {acesso.podeResponder && conversa && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ações da conversa">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {conversa.atribuida_a !== acesso.euId &&
                (acesso.supervisor || !conversa.atribuida_a) && (
                  <DropdownMenuItem onClick={() => acao.mutate({ acao: "assumir", conversaId })}>
                    <Hand className="mr-2 h-4 w-4" /> Assumir conversa
                  </DropdownMenuItem>
                )}
              {!comOutro && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UserRoundCheck className="mr-2 h-4 w-4" /> Transferir para…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>Equipe</DropdownMenuLabel>
                    {acesso.equipe
                      .filter((m) => m.podeAtender && m.id !== conversa.atribuida_a)
                      .map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          onClick={() =>
                            acao.mutate({ acao: "transferir", conversaId, paraId: m.id })
                          }
                        >
                          {m.id === acesso.euId ? "Você" : m.nome}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {conversa.atribuida_a && !comOutro && (
                <DropdownMenuItem onClick={() => acao.mutate({ acao: "liberar", conversaId })}>
                  <UserRoundX className="mr-2 h-4 w-4" /> Liberar (sem responsável)
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {!comOutro &&
                (conversa.status === "encerrada" ? (
                  <DropdownMenuItem onClick={() => acao.mutate({ acao: "reabrir", conversaId })}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reabrir
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => acao.mutate({ acao: "encerrar", conversaId })}>
                    <Lock className="mr-2 h-4 w-4" /> Encerrar atendimento
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Mensagens */}
      <div
        className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-3 py-4 sm:px-6"
        aria-live="polite"
      >
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
                  <div className="my-3 text-center">
                    <span className="rounded-full bg-background px-3 py-1 text-[11px] font-semibold capitalize text-muted-foreground shadow-sm">
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

      {/* Escrever */}
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
          vistoAte={ultima?.created_at ?? null}
          maxAnexoMb={acesso.maxAnexoMb}
          nomeCliente={conversa?.cliente_nome ?? conversa?.contact_name ?? ""}
          onEnviado={atualizar}
        />
      )}
    </div>
  );
}

function IconeStatus({ m }: { m: MensagemCentral }) {
  if (m.status === "falhou")
    return <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-label="Falhou" />;
  if (m.status === "pendente") return <Clock className="h-3.5 w-3.5" aria-label="Enviando" />;
  if (m.status === "agendado")
    return <CalendarClock className="h-3.5 w-3.5" aria-label="Agendada" />;
  if (m.status === "cancelado") return <Ban className="h-3.5 w-3.5" aria-label="Cancelada" />;
  if (m.entrega === "lido")
    return <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label="Lida" />;
  if (m.entrega === "entregue") return <CheckCheck className="h-3.5 w-3.5" aria-label="Entregue" />;
  return <Check className="h-3.5 w-3.5" aria-label="Enviada" />;
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
  const reenviar = useMutation({
    mutationFn: () => reenviarTextoFn({ data: { mensagemId: m.id } }),
    onSuccess: () => {
      toast.success("Mensagem reenviada.");
      onReenviado();
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <div className={cn("mb-2 flex", saida ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
          saida
            ? "rounded-br-md border border-primary/25 bg-primary/10"
            : "rounded-bl-md bg-background",
          m.status === "falhou" && "border-red-500/40 bg-red-500/5",
        )}
      >
        {saida && m.origem !== "atendente" && (
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {m.origem === "celular" ? (
              <>
                <Smartphone className="h-3 w-3" /> Pelo celular
              </>
            ) : (
              <>
                <Bot className="h-3 w-3" /> Automática
              </>
            )}
          </p>
        )}
        {m.resposta_a && (
          <div className="mb-1.5 border-l-2 border-primary/60 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
            {m.resposta_a_texto ? m.resposta_a_texto.slice(0, 160) : "Mensagem anterior"}
          </div>
        )}
        {m.midia_tipo && <Anexo m={m} />}
        {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
          {saida && autor && <span>{autor} ·</span>}
          <span>
            {new Date(m.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {saida && <IconeStatus m={m} />}
        </div>
        {m.status === "falhou" && (
          <div className="mt-1.5 space-y-1">
            {m.error && <p className="text-[11px] text-red-600">{m.error.slice(0, 200)}</p>}
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
      <p className="mb-1 flex items-center gap-1.5 text-xs italic text-muted-foreground">
        <FileText className="h-3.5 w-3.5" /> {m.midia_nome || `Arquivo (${m.midia_tipo})`} — não
        disponível
      </p>
    );
  }

  async function baixar() {
    setBaixando(true);
    try {
      const { url } = await linkAnexoFn({ data: { mensagemId: m.id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setBaixando(false);
    }
  }

  if (ehImagem) {
    return link.data ? (
      <a href={link.data.url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
        <img
          src={link.data.url}
          alt={m.midia_nome ?? "Imagem recebida"}
          className="max-h-72 rounded-lg object-contain"
          loading="lazy"
        />
      </a>
    ) : (
      <div className="mb-1 flex h-32 w-48 items-center justify-center rounded-lg bg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <button
      onClick={baixar}
      disabled={baixando}
      className="mb-1 flex w-full items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FileText className="h-5 w-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{m.midia_nome || "Arquivo"}</span>
        <span className="text-[10px] text-muted-foreground">{tamanhoArquivo(m.midia_tamanho)}</span>
      </span>
      {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  );
}

function Composer({
  conversaId,
  vistoAte,
  maxAnexoMb,
  nomeCliente,
  onEnviado,
}: {
  conversaId: string;
  vistoAte: string | null;
  maxAnexoMb: number;
  nomeCliente: string;
  onEnviado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [colisao, setColisao] = useState<null | (() => void)>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [resumo, setResumo] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  const sugestoesAtalho =
    filtroAtalho !== null
      ? (respostas.data ?? []).filter((r) => r.atalho.startsWith(filtroAtalho)).slice(0, 6)
      : [];

  function aplicarResposta(t: string) {
    const primeiroNome = nomeCliente.trim().split(/\s+/)[0] ?? "";
    setTexto(t.replace(/\{nome\}/gi, primeiroNome));
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

  return (
    <div className="relative border-t border-border bg-background p-2 sm:p-3">
      {sugestoesAtalho.length > 0 && (
        <ul
          className="absolute bottom-full left-2 right-2 mb-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
          role="listbox"
          aria-label="Respostas rápidas"
        >
          {sugestoesAtalho.map((r) => (
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
        </ul>
      )}

      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => ia.mutate("responder")}
          disabled={ia.isPending}
        >
          {ia.isPending && ia.variables === "responder" ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-3 w-3" />
          )}
          Sugerir resposta
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => ia.mutate("resumir")}
          disabled={ia.isPending}
        >
          {ia.isPending && ia.variables === "resumir" ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Bot className="mr-1 h-3 w-3" />
          )}
          Resumir conversa
        </Button>
        {(respostas.data?.length ?? 0) > 0 && (
          <span className="self-center text-[11px] text-muted-foreground">
            Digite / para respostas rápidas
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <input
          ref={inputArquivo}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.docx,.xlsx,audio/ogg,audio/mpeg,video/mp4"
          onChange={(e) => {
            escolherArquivo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => inputArquivo.current?.click()}
          disabled={enviando}
          aria-label="Anexar arquivo"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (sugestoesAtalho[0] && filtroAtalho !== null)
                aplicarResposta(sugestoesAtalho[0].texto);
              else if (texto.trim() && !enviando) enviarTexto.mutate(false);
            }
          }}
          onPaste={(e) => {
            const f = e.clipboardData.files[0];
            if (f) {
              e.preventDefault();
              escolherArquivo(f);
            }
          }}
          placeholder="Escreva uma mensagem (Enter envia, Shift+Enter quebra linha)"
          rows={1}
          className="max-h-40 min-h-[42px] resize-none"
          aria-label="Mensagem"
        />
        <Button
          size="icon"
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
