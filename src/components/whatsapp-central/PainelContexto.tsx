import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ExternalLink,
  History,
  Link2,
  Loader2,
  MessageSquareText,
  Unlink,
  UserRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClienteSelect } from "@/components/ClienteSelect";
import { WhatsAppSendModal, type WhatsAppOsAlvo } from "@/components/WhatsAppSendModal";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { brl, statusLabel } from "@/lib/format";
import {
  type AcaoConversa,
  acaoConversaFn,
  contextoConversaFn,
  obterConversaFn,
} from "@/lib/whatsapp/central.functions";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { QK, horaCurta, mensagemDeErro } from "./util";

export function PainelContexto({
  conversaId,
  podeResponder,
  verOrdens,
}: {
  conversaId: string;
  podeResponder: boolean;
  verOrdens: boolean;
}) {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const [escolhendo, setEscolhendo] = useState(false);
  const [osEnvio, setOsEnvio] = useState<WhatsAppOsAlvo | null>(null);
  const [etiquetaNova, setEtiquetaNova] = useState("");

  const conversa = useQuery({
    queryKey: QK.conversa(conversaId),
    queryFn: () => obterConversaFn({ data: { conversaId } }),
  });
  const ctx = useQuery({
    queryKey: QK.contexto(conversaId),
    queryFn: () => contextoConversaFn({ data: { conversaId } }),
    refetchInterval: 30_000,
  });
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

  const acao = useMutation({
    mutationFn: (dados: AcaoConversa) => acaoConversaFn({ data: dados }),
    onSuccess: () => {
      setEscolhendo(false);
      void qc.invalidateQueries({ queryKey: QK.contexto(conversaId) });
      void qc.invalidateQueries({ queryKey: QK.conversa(conversaId) });
      void qc.invalidateQueries({ queryKey: ["whatsapp-central", "conversas"] });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const c = conversa.data;
  const dados = ctx.data;

  if (ctx.isLoading || !c) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function adicionarEtiqueta() {
    const nova = etiquetaNova.trim();
    if (!nova || !c) return;
    acao.mutate({ acao: "detalhes", conversaId, etiquetas: [...new Set([...c.etiquetas, nova])] });
    setEtiquetaNova("");
  }

  return (
    <div className="space-y-5 p-4 text-sm">
      {/* Cliente */}
      <section aria-labelledby="painel-cliente">
        <h3
          id="painel-cliente"
          className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          <UserRound className="h-3.5 w-3.5" /> Cliente
        </h3>
        {dados?.cliente ? (
          <div className="rounded-xl border border-border p-3">
            <p className="font-semibold">{dados.cliente.nome}</p>
            <p className="text-xs text-muted-foreground">
              {dados.cliente.telefone
                ? formatarTelefone(dados.cliente.telefone)
                : formatarTelefone(c.phone_number)}
              {dados.cliente.email ? ` · ${dados.cliente.email}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link to="/clientes" search={{ busca: dados.cliente.nome }}>
                  <ExternalLink className="mr-1 h-3 w-3" /> Abrir cadastro
                </Link>
              </Button>
              {podeResponder && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => acao.mutate({ acao: "vincular", conversaId, clienteId: null })}
                >
                  <Unlink className="mr-1 h-3 w-3" /> Desvincular
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
            <p className="text-xs text-muted-foreground">
              {dados?.candidatos.length
                ? dados.candidatos.length > 1
                  ? "Mais de um cliente com este telefone. Confirme qual é:"
                  : "Encontramos um cliente com este telefone:"
                : "Nenhum cliente cadastrado com este telefone."}
            </p>
            {dados?.candidatos.map((cand) => (
              <div key={cand.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-medium">{cand.nome}</span>
                {podeResponder && (
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      acao.mutate({ acao: "vincular", conversaId, clienteId: cand.id })
                    }
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
                    onChange={(id) =>
                      id && acao.mutate({ acao: "vincular", conversaId, clienteId: id })
                    }
                  />
                )
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEscolhendo(true)}
                >
                  Vincular a outro cliente
                </Button>
              ))}
          </div>
        )}
      </section>

      {/* Ordens de serviço */}
      {verOrdens && dados?.cliente && (
        <section aria-labelledby="painel-os">
          <h3
            id="painel-os"
            className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            <Wrench className="h-3.5 w-3.5" /> Ordens de serviço
          </h3>
          {dados.ordens.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma OS para este cliente.</p>
          ) : (
            <ul className="space-y-2">
              {dados.ordens.map((os) => (
                <li key={os.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">OS #{os.numero}</span>
                    <span className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {statusLabel(os.status)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {[os.aparelho, os.marca, os.modelo].filter(Boolean).join(" ") ||
                      "Aparelho não informado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {os.valor != null && <>Valor: {brl(os.valor)} · </>}
                    Aberta {horaCurta(os.created_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link to="/ordens" search={{ os: os.id }}>
                        <ExternalLink className="mr-1 h-3 w-3" /> Abrir OS
                      </Link>
                    </Button>
                    {podeResponder && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setOsEnvio({
                            id: os.id,
                            numero: os.numero,
                            aparelho: os.aparelho,
                            marca: os.marca,
                            modelo: os.modelo,
                            status: os.status,
                            valor: Number(os.valor ?? 0),
                            created_at: os.created_at,
                            clientes: {
                              nome: dados.cliente?.nome ?? null,
                              telefone: c.phone_number,
                            },
                          })
                        }
                      >
                        <MessageSquareText className="mr-1 h-3 w-3" /> Mensagem / PDF
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Prioridade e etiquetas */}
      {podeResponder && (
        <section className="space-y-3">
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
            <Label className="text-xs" htmlFor="nova-etiqueta">
              Etiquetas
            </Label>
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
            <div className="flex gap-1.5">
              <Input
                id="nova-etiqueta"
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
        </section>
      )}

      {/* Histórico do atendimento */}
      {!!dados?.eventos.length && (
        <section aria-labelledby="painel-hist">
          <h3
            id="painel-hist"
            className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
          >
            <History className="h-3.5 w-3.5" /> Atendimento
          </h3>
          <ul className="space-y-1.5">
            {dados.eventos.map((e, i) => (
              <li key={i} className="flex gap-2 text-xs">
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
        </section>
      )}

      <WhatsAppSendModal
        os={osEnvio}
        open={!!osEnvio}
        onOpenChange={(o) => {
          if (!o) {
            setOsEnvio(null);
            void qc.invalidateQueries({ queryKey: QK.mensagens(conversaId) });
          }
        }}
      />
    </div>
  );
}
