import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Send,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  MODELOS_CONVITE,
  OFERTAS,
  lerListaContatos,
  normalizarTelefoneConvite,
  personalizarConvite,
  type Oferta,
} from "@/lib/convites-assinatura";
import {
  contaDoTelefoneFn,
  enviarLinkAssinaturaFn,
  listarConvitesAssinaturaFn,
  precosConviteFn,
} from "@/lib/convites-assinatura.functions";

type StatusEnvio = "pendente" | "enviando" | "ok" | "falhou";

const ROTULO_OFERTA: Record<Oferta, string> = {
  teste: "Teste grátis",
  mensal: "Mensal",
  anual: "Anual",
};

function linkCadastro() {
  return `${window.location.origin}/cadastro`;
}

// Administração do site > "Enviar link de assinatura": manda pelo WhatsApp
// da SPACE TECH o link de cadastro para quem quer assinar — um contato ou
// uma lista colada — e mostra quem já criou a conta depois de receber.
export function LinkAssinaturaDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [aba, setAba] = useState("enviar");
  const [modo, setModo] = useState<"um" | "lista">("um");
  const [oferta, setOferta] = useState<Oferta>("teste");
  const [modelo, setModelo] = useState(MODELOS_CONVITE.teste);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [lista, setLista] = useState("");
  const [status, setStatus] = useState<Record<string, StatusEnvio>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(0);
  const cancelar = useRef(false);

  const { data: precos } = useQuery({
    queryKey: ["convite-precos"],
    queryFn: () => precosConviteFn(),
  });
  const { data: enviados, isLoading: carregandoEnviados } = useQuery({
    queryKey: ["convites-assinatura"],
    queryFn: () => listarConvitesAssinaturaFn(),
  });

  const numero = normalizarTelefoneConvite(telefone);
  const { data: contaExistente } = useQuery({
    queryKey: ["convite-conta", numero],
    queryFn: () => contaDoTelefoneFn({ data: { telefone: numero! } }),
    enabled: modo === "um" && !!numero,
  });

  useEffect(() => {
    setModelo(MODELOS_CONVITE[oferta]);
  }, [oferta]);

  const { contatos, invalidas } = useMemo(() => lerListaContatos(lista), [lista]);
  const destinos =
    modo === "um" ? (numero ? [{ nome: nome.trim() || null, telefone: numero }] : []) : contatos;
  const p = precos ?? { mensal: null, anual: null };
  const textoDe = (n: string | null) =>
    personalizarConvite(modelo, { nome: n, link: linkCadastro(), precos: p });
  const exemplo = textoDe(destinos[0]?.nome ?? (nome.trim() || null));
  const concluidos = Object.values(status).filter((s) => s === "ok" || s === "falhou").length;

  async function enviar() {
    if (!destinos.length) return;
    cancelar.current = false;
    setEnviando(true);
    setStatus(Object.fromEntries(destinos.map((d) => [d.telefone, "pendente" as StatusEnvio])));
    setErros({});
    let ok = 0;
    let ultimoErro = "";
    for (const [i, d] of destinos.entries()) {
      if (cancelar.current) break;
      setStatus((s) => ({ ...s, [d.telefone]: "enviando" }));
      try {
        await enviarLinkAssinaturaFn({
          data: { nome: d.nome, telefone: d.telefone, oferta, texto: textoDe(d.nome) },
        });
        ok++;
        setStatus((s) => ({ ...s, [d.telefone]: "ok" }));
      } catch (e) {
        setStatus((s) => ({ ...s, [d.telefone]: "falhou" }));
        ultimoErro = (e as Error).message;
        setErros((x) => ({ ...x, [d.telefone]: ultimoErro }));
      }
      // Intervalo entre mensagens para o WhatsApp não bloquear o número.
      if (i < destinos.length - 1 && !cancelar.current) {
        const segundos = 30 + Math.floor(Math.random() * 31);
        for (let t = segundos; t > 0 && !cancelar.current; t--) {
          setEspera(t);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setEspera(0);
      }
    }
    setEnviando(false);
    void qc.invalidateQueries({ queryKey: ["convites-assinatura"] });
    if (ok && modo === "um") {
      toast.success("Link enviado pelo WhatsApp!");
      setNome("");
      setTelefone("");
      setStatus({});
    } else if (ok) {
      toast.success(`${ok} de ${destinos.length} links enviados.`);
    } else if (destinos.length === 1) {
      toast.error(ultimoErro || "Não foi possível enviar.");
    }
  }

  const waMe = numero
    ? `https://wa.me/${numero}?text=${encodeURIComponent(textoDe(nome.trim() || null))}`
    : null;
  const convertidos = (enviados ?? []).filter((c) => c.cadastrou).length;

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar link de assinatura</DialogTitle>
          <DialogDescription>
            Manda pelo WhatsApp da SPACE TECH o link para a pessoa criar a conta. Depois de criar,
            ela paga com Pix em <strong>Meu Plano</strong> e o acesso é liberado sozinho.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={aba} onValueChange={setAba}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="enviar">Enviar</TabsTrigger>
            <TabsTrigger value="enviados">
              Enviados{enviados?.length ? ` (${enviados.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enviar" className="space-y-5 pt-2">
            <Passo n={1} titulo="O que você quer oferecer?">
              <div className="grid gap-2 sm:grid-cols-3">
                {OFERTAS.map((o) => {
                  const preco = o.id === "mensal" ? p.mensal : o.id === "anual" ? p.anual : null;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      disabled={enviando}
                      onClick={() => setOferta(o.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left text-sm transition",
                        oferta === o.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-secondary/50",
                      )}
                    >
                      <span className="block font-semibold">{o.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.id === "teste"
                          ? "Cria a conta e usa grátis"
                          : preco
                            ? `${preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} no Pix`
                            : "Preço não configurado"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Passo>

            <Passo n={2} titulo="Para quem?">
              <div className="mb-3 flex gap-1 rounded-lg bg-muted/50 p-1 text-sm">
                {(
                  [
                    ["um", "Uma pessoa"],
                    ["lista", "Vários (colar lista)"],
                  ] as const
                ).map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    disabled={enviando}
                    onClick={() => setModo(id)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 font-medium transition",
                      modo === id ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              {modo === "um" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nome (opcional)</Label>
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex.: João da Silva"
                      disabled={enviando}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp com DDD</Label>
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(74) 99999-9999"
                      inputMode="tel"
                      disabled={enviando}
                    />
                    {telefone && !numero && (
                      <p className="text-xs text-destructive">Número incompleto.</p>
                    )}
                  </div>
                  {contaExistente && (
                    <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 sm:col-span-2 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Este número já tem conta: <strong>{contaExistente.loja}</strong>. Se a ideia é
                      renovar, ela pode pagar direto em Meu Plano.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Um contato por linha: nome e telefone</Label>
                  <Textarea
                    rows={5}
                    value={lista}
                    onChange={(e) => setLista(e.target.value)}
                    placeholder={"João Silva, 74 99999-1111\nMaria; (74) 98888-2222\n74977773333"}
                    disabled={enviando}
                  />
                  <p className="text-xs text-muted-foreground">
                    {contatos.length} contato{contatos.length === 1 ? "" : "s"} válido
                    {contatos.length === 1 ? "" : "s"}
                    {invalidas.length > 0 &&
                      ` · ${invalidas.length} linha${invalidas.length === 1 ? "" : "s"} sem telefone (ignorada${invalidas.length === 1 ? "" : "s"})`}
                    . Telefone repetido entra uma vez. Envio um por vez, com 30–60 s entre as
                    mensagens — deixe esta janela aberta até terminar.
                  </p>
                </div>
              )}
            </Passo>

            <Passo n={3} titulo="Confira a mensagem">
              <Textarea
                rows={8}
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                disabled={enviando}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {"{nome}"}, {"{link}"}, {"{preco_mensal}"} e {"{preco_anual}"} são preenchidos
                sozinhos.
              </p>
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium">Ver como a pessoa recebe</summary>
                <p className="mt-2 whitespace-pre-line rounded-lg bg-muted/50 p-3">{exemplo}</p>
              </details>
            </Passo>

            {modo === "lista" && destinos.length > 0 && (enviando || concluidos > 0) && (
              <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {destinos.map((d) => {
                  const st = status[d.telefone];
                  return (
                    <div key={d.telefone} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.nome || d.telefone}</span>
                        {erros[d.telefone] && (
                          <span className="block text-xs text-destructive">
                            {erros[d.telefone]}
                          </span>
                        )}
                      </span>
                      {st === "enviando" && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {st === "ok" && <Check className="h-4 w-4 text-emerald-600" />}
                      {st === "falhou" && <ShieldAlert className="h-4 w-4 text-destructive" />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
              {(enviando || concluidos > 0) && modo === "lista" && (
                <span className="text-xs font-semibold text-primary sm:mr-auto">
                  {concluidos}/{destinos.length}
                  {espera > 0 ? ` · próxima em ${espera}s` : ""}
                </span>
              )}
              {modo === "um" && waMe && (
                <Button variant="ghost" asChild className="sm:mr-auto">
                  <a href={waMe} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" /> Abrir no meu WhatsApp
                  </a>
                </Button>
              )}
              {enviando ? (
                <Button variant="outline" onClick={() => (cancelar.current = true)}>
                  Parar envio
                </Button>
              ) : (
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
              )}
              <Button onClick={enviar} disabled={enviando || !destinos.length || !modelo.trim()}>
                {enviando ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                {enviando
                  ? "Enviando..."
                  : destinos.length > 1
                    ? `Enviar para ${destinos.length}`
                    : "Enviar pelo WhatsApp"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="enviados" className="pt-2">
            <p className="mb-3 text-sm text-muted-foreground">
              {enviados?.length
                ? `${convertidos} de ${enviados.filter((c) => c.status === "enviado").length} já criaram a conta. Quem ainda não criou é um bom contato para lembrar.`
                : "Os links enviados aparecem aqui, com quem já criou a conta."}
            </p>
            {carregandoEnviados ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="max-h-[55vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {(enviados ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.nome || c.telefone}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.nome ? `${c.telefone} · ` : ""}
                        {ROTULO_OFERTA[c.oferta]} ·{" "}
                        {new Date(c.enviadoEm).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {c.status === "falhou" && c.erro && (
                        <span className="block text-xs text-destructive">{c.erro}</span>
                      )}
                    </span>
                    {c.status === "falhou" ? (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        Falhou
                      </span>
                    ) : c.cadastrou ? (
                      <span
                        className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600"
                        title={c.cadastrou.loja}
                      >
                        <UserCheck className="h-3 w-3" /> Criou a conta
                      </span>
                    ) : c.jaTinhaConta ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Já tinha conta
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                        Ainda não criou
                      </span>
                    )}
                  </div>
                ))}
                {!enviados?.length && (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum link enviado ainda.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {n}
        </span>
        {titulo}
      </p>
      {children}
    </section>
  );
}
