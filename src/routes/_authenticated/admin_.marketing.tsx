// Área de marketing — só para o administrador do site (mesmo e-mail fixo do
// /admin; o servidor confere de novo em obterMarketingAdmin e
// decidirConteudoMarketing). Mostra os arquivos da pasta marketing/
// (estratégia, calendário, conteúdos e o status de cada um) com prévias
// visuais, e permite aprovar ou recusar UM conteúdo por vez (bloco "Sua
// decisão"). Publicar continua sendo feito por ordem explícita do dono, fora
// desta tela.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Clapperboard,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  Megaphone,
  PenLine,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin.functions";
import { obterMarketingAdmin, type MarketingAdmin } from "@/lib/marketing/marketing.functions";
import {
  proximoPasso,
  SECAO_ARTE,
  SECAO_CTA,
  SECAO_FATOS,
  SECAO_TEXTO,
  type ConteudoMarketing,
  type StatusMarketing,
} from "@/lib/marketing/conteudo";
import { Markdown } from "@/components/marketing/Markdown";
import { MiniaturaConteudo, PreviaConteudo } from "@/components/marketing/Previa";
import { DecisaoConteudo } from "@/components/marketing/Decisao";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin_/marketing")({
  head: () => ({ meta: [{ title: "Marketing — Administração do site" }] }),
  validateSearch: (s: Record<string, unknown>): { id?: string } =>
    typeof s["id"] === "string" && /^[A-Za-z0-9-]{1,20}$/.test(s["id"]) ? { id: s["id"] } : {},
  component: PaginaMarketing,
});

const ESTILO_STATUS: Record<
  StatusMarketing,
  { rotulo: string; classe: string; icone: typeof Clock }
> = {
  "AGUARDANDO APROVAÇÃO": {
    rotulo: "Aguardando aprovação",
    classe: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icone: Clock,
  },
  APROVADO: {
    rotulo: "Aprovado",
    classe: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icone: CheckCircle2,
  },
  PUBLICADO: {
    rotulo: "Publicado",
    classe: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    icone: Send,
  },
  RASCUNHO: {
    rotulo: "Rascunho",
    classe: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    icone: PenLine,
  },
};

function SeloStatus({ status }: { status: StatusMarketing | null }) {
  if (!status) return <span className="text-xs text-destructive">Status inválido</span>;
  const e = ESTILO_STATUS[status];
  const Icone = e.icone;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        e.classe,
      )}
    >
      <Icone className="h-3 w-3" /> {e.rotulo}
    </span>
  );
}

function copiar(texto: string, oque: string) {
  navigator.clipboard
    .writeText(texto)
    .then(() => toast.success(`${oque} copiado`))
    .catch(() => toast.error("Não foi possível copiar"));
}

function PaginaMarketing() {
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const souAdmin = user?.email === SITE_ADMIN_EMAIL;
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["site-admin-marketing"],
    queryFn: () => obterMarketingAdmin(),
    enabled: souAdmin,
  });

  if (!carregandoUser && !souAdmin) {
    return (
      <div>
        <PageHeader title="Marketing" subtitle="Acesso restrito" />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Esta área é exclusiva do administrador do site."
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        {isError ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Erro ao carregar."}
          </p>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin" />
        )}
      </div>
    );
  }

  return <Conteudo data={data} onAtualizar={() => refetch()} atualizando={isFetching} />;
}

const FILTROS: { valor: StatusMarketing | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "AGUARDANDO APROVAÇÃO", rotulo: "Aguardando aprovação" },
  { valor: "APROVADO", rotulo: "Aprovados" },
  { valor: "PUBLICADO", rotulo: "Publicados" },
  { valor: "RASCUNHO", rotulo: "Rascunhos" },
];

function Conteudo({
  data,
  onAtualizar,
  atualizando,
}: {
  data: MarketingAdmin;
  onAtualizar: () => void;
  atualizando: boolean;
}) {
  const { id } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [aba, setAba] = useState("conteudos");
  const [filtro, setFiltro] = useState<StatusMarketing | "todos">("todos");

  const ids = useMemo(() => new Set(data.conteudos.map((c) => c.id)), [data.conteudos]);
  const abrir = (novo: string | undefined) => {
    navigate({ search: novo ? { id: novo } : {} });
    if (novo) setAba("conteudos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const selecionado = id ? data.conteudos.find((c) => c.id === id) : undefined;

  const contagem = (s: StatusMarketing) => data.conteudos.filter((c) => c.status === s).length;
  const lista = data.conteudos.filter((c) => filtro === "todos" || c.status === filtro);

  return (
    <div>
      <PageHeader
        title="Marketing"
        subtitle="Estratégia, calendário e conteúdos da divulgação do SPACE TECH OS. Só você vê esta área."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onAtualizar} disabled={atualizando}>
              <RefreshCw className={cn("h-4 w-4", atualizando && "animate-spin")} /> Atualizar
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin">
                <ArrowLeft className="h-4 w-4" /> Administração
              </Link>
            </Button>
          </div>
        }
      />

      {!data.disponivel ? (
        <EmptyState
          icon={Megaphone}
          title="Pasta de marketing não encontrada"
          description="Os arquivos ficam na pasta marketing/ do projeto, no servidor."
        />
      ) : (
        <>
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <strong className="text-foreground">Nada aqui é publicado sozinho.</strong> Cada
              conteúdo precisa da sua aprovação explícita e individual, e a publicação, mensagens em
              massa e anúncios pagos só acontecem por ordem sua. Para aprovar ou recusar, abra um
              conteúdo “Aguardando aprovação” e use o bloco “Sua decisão” (ou peça ao Claude).
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              ["AGUARDANDO APROVAÇÃO", "APROVADO", "PUBLICADO", "RASCUNHO"] as StatusMarketing[]
            ).map((s) => {
              const e = ESTILO_STATUS[s];
              const Icone = e.icone;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setFiltro(s);
                    setAba("conteudos");
                    abrir(undefined);
                  }}
                  className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
                >
                  <span className={cn("inline-flex rounded-lg border p-1.5", e.classe)}>
                    <Icone className="h-4 w-4" />
                  </span>
                  <p className="mt-2 text-2xl font-extrabold">{contagem(s)}</p>
                  <p className="text-xs text-muted-foreground">{e.rotulo}</p>
                </button>
              );
            })}
          </div>

          <Tabs value={aba} onValueChange={setAba}>
            <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="conteudos">Conteúdos</TabsTrigger>
              {data.documentos.map((d) => (
                <TabsTrigger key={d.chave} value={d.chave}>
                  {d.titulo}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="conteudos">
              {selecionado ? (
                <Detalhe
                  c={selecionado}
                  ids={ids}
                  onAbrirId={abrir}
                  onVoltar={() => abrir(undefined)}
                  onDecidido={onAtualizar}
                />
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {FILTROS.map((f) => (
                      <button
                        key={f.valor}
                        type="button"
                        onClick={() => setFiltro(f.valor)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-sm",
                          filtro === f.valor
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {f.rotulo}
                      </button>
                    ))}
                  </div>
                  {lista.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="Nenhum conteúdo aqui"
                      description="Escolha outro filtro."
                    />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {lista.map((c) => (
                        <button
                          key={`${c.pasta}/${c.arquivo}`}
                          type="button"
                          onClick={() => abrir(c.id)}
                          className="group flex overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md"
                        >
                          <div className="w-28 shrink-0 sm:w-32">
                            <MiniaturaConteudo c={c} />
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-primary">
                                {c.id}
                              </span>
                              <SeloStatus status={c.status} />
                              {c.midia?.video && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  <Clapperboard className="h-3 w-3" /> vídeo pronto
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-sm font-semibold text-foreground group-hover:text-primary">
                              {c.titulo}
                            </p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {c.plataforma}
                            </p>
                            {c.dataSugerida && (
                              <p className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="h-3 w-3" /> {c.dataSugerida}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {data.documentos.map((d) => (
              <TabsContent key={d.chave} value={d.chave}>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
                  <Markdown
                    manterQuebras={false}
                    texto={d.markdown}
                    idsExistentes={ids}
                    onAbrirId={abrir}
                  />
                  <p className="mt-6 text-xs text-muted-foreground">
                    Arquivo atualizado em {new Date(d.atualizadoEm).toLocaleString("pt-BR")}
                  </p>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}

function Bloco({
  titulo,
  children,
  acao,
}: {
  titulo: string;
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Explicacao({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Detalhe({
  c,
  ids,
  onAbrirId,
  onVoltar,
  onDecidido,
}: {
  c: ConteudoMarketing;
  ids: Set<string>;
  onAbrirId: (id: string) => void;
  onVoltar: () => void;
  onDecidido: () => void;
}) {
  const texto = c.secoes[SECAO_TEXTO] ?? "";
  const aprovado = c.status === "APROVADO" || c.status === "PUBLICADO";
  return (
    <div>
      <Button variant="ghost" className="mb-3 -ml-2" onClick={onVoltar}>
        <ArrowLeft className="h-4 w-4" /> Todos os conteúdos
      </Button>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-primary px-2.5 py-1 font-mono text-sm font-bold text-primary-foreground">
          {c.id}
        </span>
        <SeloStatus status={c.status} />
        {c.anuncioPago && (
          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-300">
            Anúncio pago — exige autorização de orçamento
          </span>
        )}
      </div>
      <h2 className="mb-6 text-2xl font-extrabold tracking-tight">{c.titulo}</h2>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          {c.midia?.video ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Clapperboard className="h-4 w-4 text-emerald-600" /> Vídeo gerado
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Telas reais da conta de demonstração, narração gerada no servidor. Revise antes de
                  publicar — nada é postado sem a sua ordem.
                </p>
              </div>
              <video
                key={c.midia.video.atualizadoEm}
                src={c.midia.video.url}
                poster={c.midia.capa}
                controls
                playsInline
                preload="metadata"
                className="mx-auto block w-full max-w-[300px] rounded-[1.75rem] border-4 border-zinc-800 bg-black shadow-xl"
              />
              <p className="text-center text-[11px] text-muted-foreground">
                Gerado em {new Date(c.midia.video.atualizadoEm).toLocaleString("pt-BR")} ·{" "}
                {(c.midia.video.tamanho / 1024 / 1024).toFixed(1)} MB
              </p>
              <details className="rounded-xl border border-border p-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Ver prévia ilustrativa
                </summary>
                <div className="mt-3">
                  <PreviaConteudo key={c.id} c={c} />
                </div>
              </details>
            </div>
          ) : (
            <PreviaConteudo key={c.id} c={c} />
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {c.status === "AGUARDANDO APROVAÇÃO" && (
            <DecisaoConteudo key={c.atualizadoEm} c={c} onDecidido={onDecidido} />
          )}
          <Bloco titulo="Resumo explicado">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Explicacao rotulo="O que é">{c.formato || "—"}</Explicacao>
              <Explicacao rotulo="Onde">{c.plataforma || "—"}</Explicacao>
              <Explicacao rotulo="Para quê">{c.objetivo || "—"}</Explicacao>
              <Explicacao rotulo="Quando">{c.dataSugerida || "—"}</Explicacao>
            </dl>
            <div
              className={cn(
                "mt-4 rounded-xl border p-3 text-sm",
                aprovado
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/5",
              )}
            >
              <p className="font-semibold text-foreground">Próximo passo</p>
              <p className="mt-0.5 text-muted-foreground">{proximoPasso(c)}</p>
            </div>
            {c.notas && <Markdown texto={c.notas} className="mt-4" />}
          </Bloco>

          <Bloco
            titulo="Texto pronto para publicar"
            acao={
              <Button size="sm" variant="outline" onClick={() => copiar(texto, "Texto")}>
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            }
          >
            <Markdown texto={texto} />
          </Bloco>

          {c.links.length > 0 && (
            <Bloco titulo="Links com identificação da campanha">
              <p className="mb-3 text-xs text-muted-foreground">
                O final do link (utm_…) diz de onde a pessoa veio. Instagram e TikTok não deixam
                link clicável na legenda: use o link da bio.
              </p>
              <ul className="space-y-2">
                {c.links.map((l) => (
                  <li key={l.url} className="rounded-xl border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">{l.rotulo}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => copiar(l.url, "Link")}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </Button>
                    </div>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">{l.url}</p>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          <Bloco titulo="Chamada para ação">
            <Markdown texto={c.secoes[SECAO_CTA] ?? "—"} />
          </Bloco>

          <Bloco titulo="Ideia de arte ou roteiro">
            <Markdown texto={c.secoes[SECAO_ARTE] ?? "—"} />
          </Bloco>

          <Bloco titulo="Fatos usados (conferidos no sistema)">
            <Markdown
              texto={c.secoes[SECAO_FATOS] ?? "—"}
              idsExistentes={ids}
              onAbrirId={onAbrirId}
            />
          </Bloco>

          <Bloco titulo="Aprovação e publicação">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Explicacao rotulo="Aprovado por">
                {c.aprovacao.aprovadoPor || "Ainda não aprovado"}
              </Explicacao>
              <Explicacao rotulo="Data da aprovação">{c.aprovacao.data || "—"}</Explicacao>
              <Explicacao rotulo="Plataformas autorizadas">
                {c.aprovacao.plataformas || "—"}
              </Explicacao>
              <Explicacao rotulo="Publicado em">
                {c.publicacao.dataHora || "Não publicado"}
              </Explicacao>
            </dl>
            {c.aprovacao.observacoes && (
              <p className="mt-3 text-sm text-muted-foreground">{c.aprovacao.observacoes}</p>
            )}
            {c.publicacao.link && /^https?:\/\//.test(c.publicacao.link) && (
              <a
                href={c.publicacao.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm text-primary underline"
              >
                Ver o post publicado
              </a>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Arquivo: marketing/{c.pasta}/{c.arquivo} · atualizado em{" "}
              {c.atualizadoEm ? new Date(c.atualizadoEm).toLocaleString("pt-BR") : "—"}
            </p>
          </Bloco>
        </div>
      </div>
    </div>
  );
}
