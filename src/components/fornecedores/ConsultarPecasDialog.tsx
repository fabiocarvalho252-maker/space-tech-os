// "Consultar Peças": pergunta a um ou vários fornecedores se têm uma peça.
// Com o WhatsApp da empresa conectado, envia por ele (Evolution, mesmo
// caminho da Central) e as respostas chegam em /whatsapp. Sem conexão, cai
// no wa.me: navegadores só deixam abrir uma aba por clique, então o fluxo é
// "Abrir próximo", um de cada vez, e o envio é confirmado lá, à mão.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MessageCircle,
  PackageSearch,
  RotateCcw,
  Search,
  Send,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import {
  linkConsultaWhatsapp,
  montarMensagemConsulta,
  numeroWhatsappFornecedor,
  type NumeroFornecedor,
} from "@/lib/consulta-pecas";
import { enviarConsultaPecaFn } from "@/lib/consulta-pecas.functions";
import { statusWhatsapp } from "@/lib/whatsapp/whatsapp.functions";
import { formatarTelefone } from "@/lib/whatsapp/telefone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Fornecedor = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  whatsapp: string | null;
  telefone: string | null;
};

type Envio = {
  fornecedorId: string;
  nome: string;
  numero: string;
  consultaId: string | null;
  estado: "pendente" | "enviando" | "enviada" | "falhou" | "aberta";
  erro?: string | null;
  conversaId?: string;
};

const ESTADO_LABEL: Record<Envio["estado"], string> = {
  pendente: "Aguardando envio",
  enviando: "Enviando...",
  enviada: "Enviada pelo WhatsApp da empresa",
  falhou: "Não enviada",
  aberta: "Conversa aberta no WhatsApp Web",
};

const PAUSA_ENTRE_ENVIOS_MS = 1500;

const nomeDe = (f: Fornecedor) => f.nome_fantasia?.trim() || f.razao_social;

export function ConsultarPecasDialog({
  open,
  onOpenChange,
  fornecedores,
  onEditarFornecedor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fornecedores: Fornecedor[];
  onEditarFornecedor: (id: string) => void;
}) {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const [peca, setPeca] = useState({ peca: "", qualidade: "", marca: "", modelo: "" });
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  // null = mensagem automática (saudação recalculada na hora de abrir).
  const [mensagemEditada, setMensagemEditada] = useState<string | null>(null);
  const [envios, setEnvios] = useState<Envio[] | null>(null);
  const [mensagemDoLote, setMensagemDoLote] = useState("");
  const [enviandoTodos, setEnviandoTodos] = useState(false);
  const statusConexao = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => statusWhatsapp(),
    enabled: open,
    retry: false,
  });

  const contatos = useMemo(
    () =>
      new Map<string, NumeroFornecedor>(
        fornecedores.map((f) => [f.id, numeroWhatsappFornecedor(f)]),
      ),
    [fornecedores],
  );
  const validos = fornecedores.filter((f) => contatos.get(f.id)?.ok);
  const semNumero = fornecedores.filter((f) => !contatos.get(f.id)?.ok);

  const filtrados = fornecedores.filter((f) =>
    `${f.razao_social} ${f.nome_fantasia ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  const camposOk = !!peca.peca.trim() && !!peca.modelo.trim();
  const mensagemAuto = camposOk ? montarMensagemConsulta(peca) : "";
  const mensagem = mensagemEditada ?? mensagemAuto;

  function alternar(id: string, marcado: boolean) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (marcado) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  const todosValidosMarcados = validos.length > 0 && validos.every((f) => selecionados.has(f.id));

  function reiniciar() {
    setEnvios(null);
    setSelecionados(new Set());
    setMensagemEditada(null);
    setPeca({ peca: "", qualidade: "", marca: "", modelo: "" });
  }

  const preparar = useMutation({
    mutationFn: async () => {
      if (!peca.peca.trim()) throw new Error("Informe a peça que você procura");
      if (!peca.modelo.trim()) throw new Error("Informe o modelo do aparelho");
      if (!selecionados.size) throw new Error("Selecione pelo menos um fornecedor");
      if (!mensagem.trim()) throw new Error("A mensagem está vazia");

      const lista = fornecedores
        .filter((f) => selecionados.has(f.id))
        .flatMap((f) => {
          const c = contatos.get(f.id);
          return c?.ok ? [{ f, numero: c.numero }] : [];
        });
      if (!lista.length) throw new Error("Nenhum fornecedor selecionado tem WhatsApp válido");

      // Grava a mensagem com a saudação deste momento.
      const texto = mensagemEditada ?? montarMensagemConsulta(peca);
      const loteId = crypto.randomUUID();
      const { data, error } = await supabase
        .from("fornecedor_consultas_pecas")
        .insert(
          lista.map(({ f, numero }) => ({
            user_id: empresaId!,
            lote_id: loteId,
            fornecedor_id: f.id,
            fornecedor_nome: nomeDe(f),
            whatsapp: numero,
            peca: peca.peca.trim(),
            marca: peca.marca.trim() || null,
            modelo: peca.modelo.trim(),
            qualidade: peca.qualidade.trim() || null,
            mensagem: texto,
          })),
        )
        .select("id, fornecedor_id");
      // O histórico é um extra: se não gravar, a consulta continua.
      if (error)
        toast.warning("Não foi possível salvar no histórico; a consulta segue normalmente.");
      const ids = new Map((data ?? []).map((r) => [r.fornecedor_id, r.id]));
      return {
        texto,
        envios: lista.map(({ f, numero }) => ({
          fornecedorId: f.id,
          nome: nomeDe(f),
          numero,
          consultaId: ids.get(f.id) ?? null,
          estado: "pendente" as const,
        })),
      };
    },
    onSuccess: ({ texto, envios }) => {
      setMensagemDoLote(texto);
      setEnvios(envios);
      qc.invalidateQueries({ queryKey: ["fornecedor-consultas-pecas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function marcar(fornecedorId: string, mudanca: Partial<Envio>) {
    setEnvios(
      (lista) =>
        lista?.map((e) => (e.fornecedorId === fornecedorId ? { ...e, ...mudanca } : e)) ?? null,
    );
  }

  // Alternativa sem o WhatsApp da empresa: abre o wa.me (WhatsApp Web/app).
  function abrir(envio: Envio) {
    // window.open precisa sair direto do clique, antes de qualquer await,
    // senão o navegador bloqueia como pop-up.
    window.open(
      linkConsultaWhatsapp(envio.numero, mensagemDoLote),
      "_blank",
      "noopener,noreferrer",
    );
    if (envio.estado !== "enviada") marcar(envio.fornecedorId, { estado: "aberta" });
    if (envio.consultaId) {
      void supabase
        .from("fornecedor_consultas_pecas")
        .update({ status: "conversa_aberta", conversa_aberta_em: new Date().toISOString() })
        .eq("id", envio.consultaId)
        .in("status", ["preparada", "falhou"])
        .then(() => qc.invalidateQueries({ queryKey: ["fornecedor-consultas-pecas"] }));
    }
  }

  async function enviarUm(envio: Envio): Promise<boolean> {
    if (!envio.consultaId) {
      marcar(envio.fornecedorId, {
        estado: "falhou",
        erro: "Consulta não ficou salva; use o WhatsApp Web.",
      });
      return false;
    }
    marcar(envio.fornecedorId, { estado: "enviando", erro: null });
    try {
      const r = await enviarConsultaPecaFn({ data: { consultaId: envio.consultaId } });
      if (r.ok) {
        marcar(envio.fornecedorId, { estado: "enviada", conversaId: r.conversaId });
        return true;
      }
      marcar(envio.fornecedorId, { estado: "falhou", erro: r.erro });
    } catch (e) {
      marcar(envio.fornecedorId, { estado: "falhou", erro: (e as Error).message });
    }
    return false;
  }

  // Um de cada vez, com uma pausa curta entre eles — o WhatsApp desconfia de
  // rajadas de mensagens iguais.
  async function enviarTodos() {
    if (!envios) return;
    setEnviandoTodos(true);
    let enviadas = 0;
    const pendentes = envios.filter((e) => e.estado === "pendente" || e.estado === "falhou");
    for (const [i, e] of pendentes.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, PAUSA_ENTRE_ENVIOS_MS));
      if (await enviarUm(e)) enviadas++;
    }
    setEnviandoTodos(false);
    qc.invalidateQueries({ queryKey: ["fornecedor-consultas-pecas"] });
    if (enviadas === pendentes.length) toast.success(`${enviadas} consulta(s) enviada(s)`);
    else toast.warning(`${enviadas} de ${pendentes.length} enviadas. Veja as que falharam.`);
  }

  const conectado = statusConexao.data?.status === "conectado";
  const faltamEnviar =
    envios?.filter((e) => e.estado === "pendente" || e.estado === "falhou").length ?? 0;
  const proximo = envios?.find((e) => e.estado === "pendente" || e.estado === "falhou");
  const resolvidas =
    envios?.filter((e) => e.estado === "enviada" || e.estado === "aberta").length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && enviandoTodos) return;
        onOpenChange(v);
        if (!v && envios) reiniciar();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" /> Consultar peças
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pergunte a vários fornecedores de uma vez se eles têm a peça, pelo WhatsApp.
          </p>
        </DialogHeader>

        {!envios ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Peça *</Label>
                <Input
                  value={peca.peca}
                  onChange={(e) => setPeca({ ...peca, peca: e.target.value })}
                  placeholder="Ex.: tela, bateria, conector de carga"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo / qualidade</Label>
                <Input
                  value={peca.qualidade}
                  onChange={(e) => setPeca({ ...peca, qualidade: e.target.value })}
                  placeholder="Ex.: OLED, incell, original (opcional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Input
                  value={peca.marca}
                  onChange={(e) => setPeca({ ...peca, marca: e.target.value })}
                  placeholder="Ex.: Apple, Samsung, Motorola"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo *</Label>
                <Input
                  value={peca.modelo}
                  onChange={(e) => setPeca({ ...peca, modelo: e.target.value })}
                  placeholder="Ex.: iPhone 13, Galaxy A54"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>
                  Fornecedores{" "}
                  <span className="font-normal text-muted-foreground">
                    ({selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"})
                  </span>
                </Label>
                <button
                  type="button"
                  disabled={!validos.length}
                  onClick={() =>
                    setSelecionados(
                      todosValidosMarcados ? new Set() : new Set(validos.map((f) => f.id)),
                    )
                  }
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {todosValidosMarcados ? "Limpar seleção" : `Selecionar todos (${validos.length})`}
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar fornecedor pelo nome..."
                  className="pl-9"
                />
              </div>
              <div className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {filtrados.map((f) => {
                  const c = contatos.get(f.id);
                  const ok = !!c?.ok;
                  return (
                    <label
                      key={f.id}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm ${ok ? "cursor-pointer hover:bg-secondary/60" : "opacity-70"}`}
                    >
                      <Checkbox
                        checked={selecionados.has(f.id)}
                        disabled={!ok}
                        onCheckedChange={(v) => alternar(f.id, v === true)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{nomeDe(f)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c?.ok
                            ? `${formatarTelefone(c.numero)}${c.origem === "telefone" ? " · do campo Telefone" : ""}`
                            : c?.motivo === "invalido"
                              ? "Número de WhatsApp inválido"
                              : "Sem WhatsApp cadastrado"}
                        </p>
                      </div>
                      {!ok && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onEditarFornecedor(f.id);
                          }}
                          className="shrink-0 text-xs font-medium text-primary hover:underline"
                        >
                          Cadastrar número
                        </button>
                      )}
                    </label>
                  );
                })}
                {!filtrados.length && (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {fornecedores.length
                      ? "Nenhum fornecedor encontrado."
                      : "Nenhum fornecedor cadastrado ainda."}
                  </p>
                )}
              </div>
              {semNumero.length > 0 && (
                <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    {semNumero.length === 1
                      ? "1 fornecedor está sem WhatsApp válido e não pode ser consultado: "
                      : `${semNumero.length} fornecedores estão sem WhatsApp válido e não podem ser consultados: `}
                    <strong>{semNumero.map(nomeDe).join(", ")}</strong>.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Mensagem</Label>
                {mensagemEditada !== null && (
                  <button
                    type="button"
                    onClick={() => setMensagemEditada(null)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" /> Voltar à automática
                  </button>
                )}
              </div>
              <Textarea
                rows={4}
                value={mensagem}
                disabled={!camposOk && mensagemEditada === null}
                onChange={(e) => setMensagemEditada(e.target.value)}
                placeholder="Informe a peça e o modelo para gerar a mensagem."
              />
              <p className="text-xs text-muted-foreground">
                A saudação (bom dia / boa tarde / boa noite) segue o horário de Brasília. Você pode
                ajustar o texto antes de enviar.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => preparar.mutate()}
              disabled={preparar.isPending}
            >
              <MessageCircle className="h-4 w-4" />
              {selecionados.size
                ? `Preparar consulta para ${selecionados.size} fornecedor${selecionados.size === 1 ? "" : "es"}`
                : "Preparar consulta"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="whitespace-pre-line rounded-xl border border-border bg-secondary/50 p-3 text-sm">
              {mensagemDoLote}
            </div>

            {statusConexao.isLoading ? (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : conectado ? (
              <>
                <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    A mensagem sai pelo WhatsApp conectado da empresa
                    {statusConexao.data?.phone_number
                      ? ` (${formatarTelefone(statusConexao.data.phone_number)})`
                      : ""}
                    . As respostas dos fornecedores chegam na Central de WhatsApp e a consulta é
                    marcada como respondida sozinha.
                  </span>
                </div>
                {faltamEnviar > 0 ? (
                  <Button className="w-full" onClick={enviarTodos} disabled={enviandoTodos}>
                    {enviandoTodos ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {enviandoTodos
                      ? "Enviando..."
                      : `Enviar para ${faltamEnviar} fornecedor${faltamEnviar === 1 ? "" : "es"}`}
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Consultas enviadas. Acompanhe as respostas na Central de WhatsApp.
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    O WhatsApp da empresa não está conectado, então a consulta abre no WhatsApp Web.
                    Abrir a conversa <strong>não envia</strong> a mensagem: toque em enviar lá e
                    volte para o próximo. Para enviar direto pelo sistema, conecte em{" "}
                    <Link to="/whatsapp-conexao" className="font-medium text-primary underline">
                      WhatsApp → Conexão
                    </Link>
                    .
                  </span>
                </div>
                {proximo ? (
                  <Button className="w-full" onClick={() => abrir(proximo)}>
                    <ArrowRight className="h-4 w-4" />
                    Abrir WhatsApp: {proximo.nome} ({resolvidas + 1} de {envios.length})
                  </Button>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Todas as {envios.length} conversas foram abertas. Confira se enviou cada uma.
                  </div>
                )}
              </>
            )}

            <div className="divide-y divide-border rounded-xl border border-border">
              {envios.map((e) => (
                <div
                  key={e.fornecedorId}
                  className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-medium">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatarTelefone(e.numero)} · {ESTADO_LABEL[e.estado]}
                    </p>
                    {e.estado === "falhou" && e.erro && (
                      <p className="text-xs text-destructive">{e.erro}</p>
                    )}
                  </div>
                  {e.estado === "enviando" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {e.estado === "enviada" && e.conversaId && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/whatsapp" search={{ c: e.conversaId }}>
                        <MessageCircle className="h-4 w-4" /> Ver conversa
                      </Link>
                    </Button>
                  )}
                  {conectado && e.estado === "falhou" && (
                    <Button
                      size="sm"
                      disabled={enviandoTodos}
                      onClick={() =>
                        void enviarUm(e).then(() =>
                          qc.invalidateQueries({ queryKey: ["fornecedor-consultas-pecas"] }),
                        )
                      }
                    >
                      <RotateCcw className="h-4 w-4" /> Tentar de novo
                    </Button>
                  )}
                  {e.estado !== "enviada" && e.estado !== "enviando" && (
                    <Button
                      size="sm"
                      variant={conectado || e.estado === "aberta" ? "outline" : "default"}
                      onClick={() => abrir(e)}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {conectado
                        ? "WhatsApp Web"
                        : e.estado === "aberta"
                          ? "Abrir de novo"
                          : "Abrir WhatsApp"}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={reiniciar}
              disabled={enviandoTodos}
            >
              <RotateCcw className="h-4 w-4" /> Nova consulta
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
