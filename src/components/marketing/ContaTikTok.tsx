// TikTok no /admin/marketing:
//  - ContaTikTok: card da aba "Contas" (conectar/desconectar).
//  - EnviarTikTok: bloco no detalhe de um conteúdo aprovado para o TikTok.
//    "Rascunho" manda o vídeo para a caixa de entrada do app; "Publicar"
//    posta direto, mostrando o que o TikTok exige antes (conta, privacidade
//    sem padrão, interações, divulgação comercial e o aceite das regras).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Inbox, Link2, Loader2, LogOut, Music2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  desconectarTikTok,
  enviarTikTok,
  iniciarConexaoTikTok,
  obterContaTikTok,
  obterCriadorTikTok,
} from "@/lib/marketing/tiktok.functions";
import {
  textoParaPublicar,
  tiktokAutorizado,
  type ConteudoMarketing,
} from "@/lib/marketing/conteudo";

const CHAVE = ["site-admin-marketing-tiktok"];

const ROTULO_PRIVACIDADE: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Todos (público)",
  MUTUAL_FOLLOW_FRIENDS: "Amigos (seguidores mútuos)",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Só eu (privado)",
};

function useContaTikTok() {
  return useQuery({ queryKey: CHAVE, queryFn: () => obterContaTikTok() });
}

export function ContaTikTok() {
  const qc = useQueryClient();
  const { data, isLoading } = useContaTikTok();
  const [sair, setSair] = useState(false);

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoTikTok(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar a conexão."),
  });
  const desconectar = useMutation({
    mutationFn: () => desconectarTikTok(),
    onSuccess: () => {
      setSair(false);
      toast.success("TikTok desconectado.");
      qc.invalidateQueries({ queryKey: CHAVE });
    },
  });

  if (isLoading || !data)
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center rounded-xl bg-black p-2 text-white">
          <Music2 className="h-5 w-5" />
        </span>
        {data.avatar && (
          <img src={data.avatar} alt="" className="h-9 w-9 rounded-full border border-border" />
        )}
        <div>
          <h2 className="text-base font-bold">TikTok</h2>
          <p className="text-sm text-muted-foreground">
            {data.conectado
              ? `Conectado: ${data.nome || "—"} em ${new Date(data.conectadoEm!).toLocaleString("pt-BR")}`
              : "Não conectado"}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {data.conectado ? (
            <>
              <Button
                variant="outline"
                onClick={() => conectar.mutate()}
                disabled={conectar.isPending}
              >
                <Link2 className="h-4 w-4" /> Reconectar
              </Button>
              <Button variant="ghost" onClick={() => setSair(true)}>
                <LogOut className="h-4 w-4" /> Desconectar
              </Button>
            </>
          ) : (
            <Button
              onClick={() => conectar.mutate()}
              disabled={!data.configurado || conectar.isPending}
            >
              {conectar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Conectar TikTok
            </Button>
          )}
        </div>
      </div>
      {!data.configurado && (
        <p className="mt-3 text-sm text-destructive">
          Faltam TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET no .env do servidor.
        </p>
      )}
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          “Enviar como rascunho” manda o vídeo para a caixa de entrada do TikTok; você termina e
          publica pelo app.
        </li>
        <li>
          “Publicar no TikTok” posta direto. Até o app ser aprovado pelo TikTok, só é aceito como
          “Só eu (privado)”.
        </li>
      </ul>
      <ConfirmDialog
        open={sair}
        onOpenChange={setSair}
        title="Desconectar o TikTok?"
        description="O sistema esquece o acesso. Vídeos já enviados continuam no TikTok."
        confirmLabel="Desconectar"
        destructive
        loading={desconectar.isPending}
        onConfirm={() => desconectar.mutate()}
      />
    </section>
  );
}

// Copia a legenda (o TikTok não recebe texto nos rascunhos enviados pelo
// sistema). Usa a área de transferência e, se o navegador recusar, o método
// antigo com um campo temporário — funciona também no celular.
async function copiarLegenda(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    t.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    t.remove();
    if (!ok) {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
      return;
    }
  }
  toast.success("Legenda copiada. Cole no TikTok.");
}

function linkTikTok(c: ConteudoMarketing): string | null {
  const m = (c.secoes["Publicação"] ?? "").match(/^- Publicado no TikTok: (\S+)/m);
  return m?.[1] ?? null;
}

export function EnviarTikTok({
  c,
  onEnviado,
  onIrParaContas,
}: {
  c: ConteudoMarketing;
  onEnviado: () => void;
  onIrParaContas: () => void;
}) {
  const { data: conta } = useContaTikTok();
  const [modo, setModo] = useState<"rascunho" | "direto" | null>(null);
  const [privacidade, setPrivacidade] = useState("");
  const [comentario, setComentario] = useState(false);
  const [dueto, setDueto] = useState(false);
  const [costura, setCostura] = useState(false);
  const [divulgar, setDivulgar] = useState(false);
  const [marcaPropria, setMarcaPropria] = useState(false);

  const criador = useQuery({
    queryKey: ["site-admin-marketing-tiktok-criador"],
    queryFn: () => obterCriadorTikTok(),
    enabled: modo === "direto",
    staleTime: 0,
  });

  const enviar = useMutation({
    mutationFn: (m: "rascunho" | "direto") =>
      enviarTikTok({
        data: {
          id: c.id,
          modo: m,
          versao: c.atualizadoEm,
          ...(m === "direto"
            ? {
                opcoes: {
                  privacidade,
                  permitirComentario: comentario,
                  permitirDueto: dueto,
                  permitirCostura: costura,
                  marcaPropria: divulgar && marcaPropria,
                },
              }
            : {}),
        },
      }),
    onSuccess: (r, m) => {
      setModo(null);
      if (m === "rascunho")
        toast.success(
          `${c.id} enviado ao TikTok. Toque em “Copiar legenda”, abra o app e cole ao publicar.`,
        );
      else
        toast.success(`${c.id} publicado no TikTok.`, {
          action: r.link
            ? { label: "Ver", onClick: () => window.open(r.link!, "_blank") }
            : undefined,
        });
      onEnviado();
    },
    onError: (e) => {
      setModo(null);
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar ao TikTok.");
    },
  });

  if (!tiktokAutorizado(c)) return null;
  const feito = linkTikTok(c);
  const temVideo = Boolean(c.midia?.video);
  const info = criador.data;
  const podePublicar = Boolean(privacidade) && (!divulgar || marcaPropria) && !enviar.isPending;

  return (
    <section className="rounded-2xl border-2 border-zinc-500/40 bg-zinc-500/5 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Music2 className="h-4 w-4" /> TikTok
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => void copiarLegenda(textoParaPublicar(c, "tiktok"))}
        >
          <Copy className="h-4 w-4" /> Copiar legenda
        </Button>
      </h2>
      {feito ? (
        <a
          href={feito}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          <ExternalLink className="h-4 w-4" /> Publicado no TikTok
        </a>
      ) : !conta?.conectado ? (
        <p className="mt-2 text-sm">
          Conecte o TikTok primeiro.{" "}
          <button
            type="button"
            onClick={onIrParaContas}
            className="font-semibold text-primary underline"
          >
            Ir para Contas
          </button>
        </p>
      ) : !temVideo ? (
        <p className="mt-2 text-sm text-muted-foreground">
          O TikTok só aceita vídeo. Gere o vídeo deste conteúdo primeiro.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModo("rascunho")}>
            <Inbox className="h-4 w-4" /> Enviar como rascunho
          </Button>
          {conta.podeDireto && (
            <Button
              onClick={() => {
                setPrivacidade("");
                setComentario(false);
                setDueto(false);
                setCostura(false);
                setDivulgar(false);
                setMarcaPropria(false);
                setModo("direto");
              }}
            >
              <Send className="h-4 w-4" /> Publicar no TikTok
            </Button>
          )}
        </div>
      )}

      <Dialog open={modo !== null} onOpenChange={(v) => !v && !enviar.isPending && setModo(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modo === "rascunho"
                ? `Enviar o ${c.id} ao TikTok como rascunho?`
                : `Publicar o ${c.id} no TikTok?`}
            </DialogTitle>
            <DialogDescription>
              {modo === "rascunho"
                ? `O vídeo vai para a caixa de entrada do TikTok de ${conta?.nome || "sua conta"}. Nada fica público: você abre o app, cola o texto abaixo e publica.`
                : "Confira a conta e escolha as opções. O vídeo pode levar alguns minutos para aparecer no perfil."}
            </DialogDescription>
          </DialogHeader>

          {modo === "direto" &&
            (criador.isLoading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : criador.error ? (
              <p className="text-sm text-destructive">
                {criador.error instanceof Error
                  ? criador.error.message
                  : "Não foi possível consultar a conta do TikTok."}
              </p>
            ) : info ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  {info.avatar && <img src={info.avatar} alt="" className="h-9 w-9 rounded-full" />}
                  <div>
                    <p className="font-semibold">{info.nome}</p>
                    <p className="text-muted-foreground">@{info.usuario}</p>
                  </div>
                </div>
                {c.midia?.video && (
                  <video
                    src={c.midia.video.url}
                    controls
                    className="mx-auto max-h-64 rounded-lg bg-black"
                  />
                )}
                <label className="block space-y-1">
                  <span className="font-semibold">Quem pode ver *</span>
                  <select
                    value={privacidade}
                    onChange={(e) => setPrivacidade(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <option value="" disabled>
                      Escolha…
                    </option>
                    {info.privacidades.map((p) => (
                      <option key={p} value={p}>
                        {ROTULO_PRIVACIDADE[p] ?? p}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="space-y-1">
                  <span className="font-semibold">Permitir</span>
                  {(
                    [
                      ["Comentários", comentario, setComentario, info.comentarioBloqueado],
                      ["Dueto", dueto, setDueto, info.dueteBloqueado],
                      ["Costura (Stitch)", costura, setCostura, info.costuraBloqueada],
                    ] as const
                  ).map(([rot, val, set, bloq]) => (
                    <label key={rot} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={val && !bloq}
                        disabled={bloq}
                        onChange={(e) => set(e.target.checked)}
                      />
                      {rot}
                      {bloq && (
                        <span className="text-xs text-muted-foreground">
                          (desativado nas configurações da conta)
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="space-y-1 rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      checked={divulgar}
                      onChange={(e) => setDivulgar(e.target.checked)}
                    />
                    Divulgar conteúdo comercial
                  </label>
                  {divulgar && (
                    <>
                      <label className="flex items-center gap-2 pl-5">
                        <input
                          type="checkbox"
                          checked={marcaPropria}
                          onChange={(e) => setMarcaPropria(e.target.checked)}
                        />
                        Sua marca (promove o seu próprio negócio)
                      </label>
                      <p className="pl-5 text-xs text-muted-foreground">
                        O vídeo será marcado como “Conteúdo promocional”.
                      </p>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ao publicar, você concorda com a{" "}
                  <a
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Confirmação de Uso de Música
                  </a>{" "}
                  do TikTok.
                </p>
              </div>
            ) : null)}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {modo === "rascunho" ? "Texto para colar no app" : "Legenda"}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void copiarLegenda(textoParaPublicar(c, "tiktok"))}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-sans text-sm">
              {textoParaPublicar(c, "tiktok")}
            </pre>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModo(null)} disabled={enviar.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => modo && enviar.mutate(modo)}
              disabled={modo === "direto" ? !podePublicar || !info : enviar.isPending}
            >
              {enviar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : modo === "rascunho" ? (
                <Inbox className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {enviar.isPending
                ? "Enviando…"
                : modo === "rascunho"
                  ? "Enviar rascunho"
                  : "Publicar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
