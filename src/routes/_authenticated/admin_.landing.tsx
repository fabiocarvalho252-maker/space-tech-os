// Editor da landing page pública (/) — só para o administrador do site
// (mesmo e-mail fixo do /admin; o servidor confere de novo em
// salvarLanding/prepararUploadLanding). Textos, fotos e depoimentos ficam em
// public.site_landing; preços e recursos dos planos continuam sendo
// editados na seção "Planos" do /admin.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { SITE_ADMIN_EMAIL } from "@/lib/site-admin.functions";
import {
  obterLandingAdmin,
  prepararUploadLanding,
  salvarLanding,
} from "@/lib/landing/landing.functions";
import {
  ICONES_LANDING,
  LANDING_PADRAO,
  landingSchema,
  type IconeLanding,
  type LandingConteudo,
} from "@/lib/landing/conteudo";
import { ICONE_LANDING, ROTULO_ICONE } from "@/components/landing/icones";

export const Route = createFileRoute("/_authenticated/admin_/landing")({
  head: () => ({ meta: [{ title: "Página inicial — Administração do site" }] }),
  component: EditorLanding,
});

const TIPOS_IMAGEM = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type TipoImagem = (typeof TIPOS_IMAGEM)[number];
const TAMANHO_MAX = 5 * 1024 * 1024;

async function enviarImagem(file: File): Promise<string> {
  if (!(TIPOS_IMAGEM as readonly string[]).includes(file.type)) {
    throw new Error("Use uma imagem PNG, JPG, WEBP ou GIF.");
  }
  if (file.size > TAMANHO_MAX) throw new Error("A imagem precisa ter no máximo 5 MB.");
  const { path, token } = await prepararUploadLanding({ data: { tipo: file.type as TipoImagem } });
  const { error } = await supabase.storage
    .from("landing")
    .uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw error;
  // Montada no navegador para usar o domínio público do Supabase.
  return supabase.storage.from("landing").getPublicUrl(path).data.publicUrl;
}

function linhas(texto: string) {
  return texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function mover<T>(lista: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j]!, nova[i]!];
  return nova;
}

function EditorLanding() {
  const { data: user, isLoading: carregandoUser } = useCurrentUser();
  const souAdmin = user?.email === SITE_ADMIN_EMAIL;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["site-admin-landing"],
    queryFn: () => obterLandingAdmin(),
    enabled: souAdmin,
  });

  if (!carregandoUser && !souAdmin) {
    return (
      <div>
        <PageHeader title="Página inicial" subtitle="Acesso restrito" />
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

  return <Formulario inicial={data} />;
}

function Formulario({ inicial }: { inicial: LandingConteudo }) {
  const qc = useQueryClient();
  const [c, setC] = useState<LandingConteudo>(inicial);
  const [alterado, setAlterado] = useState(false);
  const [confirmPadrao, setConfirmPadrao] = useState(false);

  // Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  function atualizar<K extends keyof LandingConteudo>(
    secao: K,
    valor: Partial<LandingConteudo[K]>,
  ) {
    setC((atual) => ({ ...atual, [secao]: { ...atual[secao], ...valor } }));
    setAlterado(true);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const r = landingSchema.safeParse(c);
      if (!r.success) {
        const problema = r.error.issues[0];
        throw new Error(
          `Revise o campo "${problema?.path.join(" › ")}": ${problema?.message ?? "inválido"}`,
        );
      }
      await salvarLanding({ data: r.data });
    },
    onSuccess: () => {
      toast.success("Página inicial salva. Já está no ar.");
      setAlterado(false);
      qc.invalidateQueries({ queryKey: ["site-admin-landing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { hero, recursos, beneficios, passos, mobile, planos, depoimentos, ctaFinal, seo } = c;

  return (
    <div className="pb-24">
      <PageHeader
        title="Página inicial (landing)"
        subtitle="Textos, fotos e depoimentos que os visitantes veem em srmpretech.online."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/admin">
                <ArrowLeft className="h-4 w-4" /> Voltar ao admin
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="/?previa=1" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Ver página
              </a>
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        <SectionCard title="Topo da página (hero)" subtitle="A primeira coisa que o visitante vê.">
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Selo acima do título">
              <Input
                value={hero.selo}
                onChange={(e) => atualizar("hero", { selo: e.target.value })}
              />
            </Campo>
            <Campo label="Texto abaixo dos botões">
              <Input
                value={hero.nota}
                onChange={(e) => atualizar("hero", { nota: e.target.value })}
              />
            </Campo>
            <Campo label="Título principal" className="md:col-span-2">
              <Textarea
                rows={2}
                value={hero.titulo}
                onChange={(e) => atualizar("hero", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Texto de apoio" className="md:col-span-2">
              <Textarea
                rows={2}
                value={hero.subtitulo}
                onChange={(e) => atualizar("hero", { subtitulo: e.target.value })}
              />
            </Campo>
            <Campo label="Botão principal (vai para o cadastro)">
              <Input
                value={hero.ctaPrimario}
                onChange={(e) => atualizar("hero", { ctaPrimario: e.target.value })}
              />
            </Campo>
            <Campo label="Botão secundário (vai para o login)">
              <Input
                value={hero.ctaSecundario}
                onChange={(e) => atualizar("hero", { ctaSecundario: e.target.value })}
              />
            </Campo>
            <ImagemCampo
              className="md:col-span-2"
              label="Foto do sistema no topo"
              dica="Um print do dashboard fica ótimo (formato largo, ex.: 1600×1000). Sem foto, aparece a ilustração padrão."
              valor={hero.imagem}
              onChange={(url) => atualizar("hero", { imagem: url })}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Recursos (módulos)"
          subtitle="Cards da seção “Tudo o que sua assistência precisa”."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Título da seção">
              <Input
                value={recursos.titulo}
                onChange={(e) => atualizar("recursos", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Subtítulo">
              <Input
                value={recursos.subtitulo}
                onChange={(e) => atualizar("recursos", { subtitulo: e.target.value })}
              />
            </Campo>
          </div>
          <div className="mt-4 space-y-3">
            {recursos.itens.map((item, i) => {
              const setItem = (v: Partial<typeof item>) =>
                atualizar("recursos", {
                  itens: recursos.itens.map((x, j) => (j === i ? { ...x, ...v } : x)),
                });
              return (
                <ItemLista
                  key={i}
                  titulo={item.titulo || `Card ${i + 1}`}
                  onSubir={() => atualizar("recursos", { itens: mover(recursos.itens, i, -1) })}
                  onDescer={() => atualizar("recursos", { itens: mover(recursos.itens, i, 1) })}
                  onRemover={() =>
                    atualizar("recursos", { itens: recursos.itens.filter((_, j) => j !== i) })
                  }
                >
                  <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                    <Campo label="Ícone">
                      <Select
                        value={item.icone}
                        onValueChange={(v) => setItem({ icone: v as IconeLanding })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ICONES_LANDING.map((ic) => {
                            const Icone = ICONE_LANDING[ic];
                            return (
                              <SelectItem key={ic} value={ic}>
                                <span className="flex items-center gap-2">
                                  <Icone className="h-4 w-4" /> {ROTULO_ICONE[ic]}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </Campo>
                    <Campo label="Título">
                      <Input
                        value={item.titulo}
                        onChange={(e) => setItem({ titulo: e.target.value })}
                      />
                    </Campo>
                    <Campo label="Descrição" className="md:col-span-2">
                      <Input
                        value={item.descricao}
                        onChange={(e) => setItem({ descricao: e.target.value })}
                      />
                    </Campo>
                    <label className="flex items-center gap-2 text-sm md:col-span-2">
                      <Switch
                        checked={item.emBreve}
                        onCheckedChange={(v) => setItem({ emBreve: v })}
                      />
                      Mostrar selo “Em breve”
                    </label>
                  </div>
                </ItemLista>
              );
            })}
            {recursos.itens.length < 16 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  atualizar("recursos", {
                    itens: [
                      ...recursos.itens,
                      { icone: "sparkles", titulo: "", descricao: "", emBreve: false },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" /> Adicionar card
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Benefícios" subtitle="Blocos de texto + foto, alternando os lados.">
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Título da seção">
              <Input
                value={beneficios.titulo}
                onChange={(e) => atualizar("beneficios", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Subtítulo">
              <Input
                value={beneficios.subtitulo}
                onChange={(e) => atualizar("beneficios", { subtitulo: e.target.value })}
              />
            </Campo>
          </div>
          <div className="mt-4 space-y-3">
            {beneficios.blocos.map((bloco, i) => {
              const setBloco = (v: Partial<typeof bloco>) =>
                atualizar("beneficios", {
                  blocos: beneficios.blocos.map((x, j) => (j === i ? { ...x, ...v } : x)),
                });
              return (
                <ItemLista
                  key={i}
                  titulo={bloco.titulo || `Bloco ${i + 1}`}
                  onSubir={() =>
                    atualizar("beneficios", { blocos: mover(beneficios.blocos, i, -1) })
                  }
                  onDescer={() =>
                    atualizar("beneficios", { blocos: mover(beneficios.blocos, i, 1) })
                  }
                  onRemover={() =>
                    atualizar("beneficios", { blocos: beneficios.blocos.filter((_, j) => j !== i) })
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <Campo label="Título">
                      <Input
                        value={bloco.titulo}
                        onChange={(e) => setBloco({ titulo: e.target.value })}
                      />
                    </Campo>
                    <Campo label="Texto">
                      <Input
                        value={bloco.texto}
                        onChange={(e) => setBloco({ texto: e.target.value })}
                      />
                    </Campo>
                    <ListaLinhas
                      label="Itens com ✓ (um por linha, até 8)"
                      valor={bloco.itens}
                      max={8}
                      onChange={(itens) => setBloco({ itens })}
                    />
                    <ImagemCampo
                      label="Foto do bloco"
                      dica="Sem foto, aparece a ilustração padrão."
                      valor={bloco.imagem}
                      onChange={(url) => setBloco({ imagem: url })}
                    />
                  </div>
                </ItemLista>
              );
            })}
            {beneficios.blocos.length < 4 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  atualizar("beneficios", {
                    blocos: [
                      ...beneficios.blocos,
                      { titulo: "", texto: "", itens: [], imagem: "" },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" /> Adicionar bloco
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Como funciona" subtitle="Os passos numerados.">
          <Campo label="Título da seção">
            <Input
              value={passos.titulo}
              onChange={(e) => atualizar("passos", { titulo: e.target.value })}
            />
          </Campo>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {passos.itens.map((p, i) => {
              const setPasso = (v: Partial<typeof p>) =>
                atualizar("passos", {
                  itens: passos.itens.map((x, j) => (j === i ? { ...x, ...v } : x)),
                });
              return (
                <div key={i} className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</p>
                  <Input
                    aria-label={`Título do passo ${i + 1}`}
                    value={p.titulo}
                    onChange={(e) => setPasso({ titulo: e.target.value })}
                  />
                  <Textarea
                    aria-label={`Texto do passo ${i + 1}`}
                    rows={2}
                    value={p.texto}
                    onChange={(e) => setPasso({ texto: e.target.value })}
                  />
                  {passos.itens.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() =>
                        atualizar("passos", { itens: passos.itens.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="h-4 w-4" /> Remover
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {passos.itens.length < 4 && (
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={() =>
                atualizar("passos", { itens: [...passos.itens, { titulo: "", texto: "" }] })
              }
            >
              <Plus className="h-4 w-4" /> Adicionar passo
            </Button>
          )}
        </SectionCard>

        <SectionCard title="Seção do celular" subtitle="“Sua assistência na palma da mão”.">
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Título">
              <Input
                value={mobile.titulo}
                onChange={(e) => atualizar("mobile", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Texto">
              <Input
                value={mobile.texto}
                onChange={(e) => atualizar("mobile", { texto: e.target.value })}
              />
            </Campo>
            <ListaLinhas
              label="Itens na tela do celular (um por linha, até 6)"
              valor={mobile.itens}
              max={6}
              onChange={(itens) => atualizar("mobile", { itens })}
            />
            <ImagemCampo
              label="Print do celular"
              dica="Formato vertical (ex.: 900×1900). Substitui a ilustração dentro do celular."
              valor={mobile.imagem}
              onChange={(url) => atualizar("mobile", { imagem: url })}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Planos"
          subtitle="Preço e recursos vêm dos planos ativos — edite na seção Planos do /admin."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Campo label="Título da seção">
              <Input
                value={planos.titulo}
                onChange={(e) => atualizar("planos", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Subtítulo">
              <Input
                value={planos.subtitulo}
                onChange={(e) => atualizar("planos", { subtitulo: e.target.value })}
              />
            </Campo>
            <Campo label="Texto quando o plano não tem preço">
              <Input
                value={planos.textoSemPreco}
                onChange={(e) => atualizar("planos", { textoSemPreco: e.target.value })}
              />
            </Campo>
          </div>
        </SectionCard>

        <SectionCard
          title="Depoimentos"
          subtitle="Use só depoimentos reais. Sem nenhum, a seção mostra situações do dia a dia."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Título da seção">
              <Input
                value={depoimentos.titulo}
                onChange={(e) => atualizar("depoimentos", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Subtítulo">
              <Input
                value={depoimentos.subtitulo}
                onChange={(e) => atualizar("depoimentos", { subtitulo: e.target.value })}
              />
            </Campo>
          </div>
          <div className="mt-4 space-y-3">
            {depoimentos.itens.map((d, i) => {
              const setDep = (v: Partial<typeof d>) =>
                atualizar("depoimentos", {
                  itens: depoimentos.itens.map((x, j) => (j === i ? { ...x, ...v } : x)),
                });
              return (
                <ItemLista
                  key={i}
                  titulo={d.nome || `Depoimento ${i + 1}`}
                  onSubir={() =>
                    atualizar("depoimentos", { itens: mover(depoimentos.itens, i, -1) })
                  }
                  onDescer={() =>
                    atualizar("depoimentos", { itens: mover(depoimentos.itens, i, 1) })
                  }
                  onRemover={() =>
                    atualizar("depoimentos", { itens: depoimentos.itens.filter((_, j) => j !== i) })
                  }
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <Campo label="Nome">
                      <Input value={d.nome} onChange={(e) => setDep({ nome: e.target.value })} />
                    </Campo>
                    <Campo label="Assistência / cidade">
                      <Input
                        value={d.empresa}
                        onChange={(e) => setDep({ empresa: e.target.value })}
                      />
                    </Campo>
                    <Campo label="Depoimento" className="md:col-span-2">
                      <Textarea
                        rows={3}
                        value={d.texto}
                        onChange={(e) => setDep({ texto: e.target.value })}
                      />
                    </Campo>
                    <ImagemCampo
                      className="md:col-span-2"
                      label="Foto (opcional)"
                      valor={d.foto}
                      onChange={(url) => setDep({ foto: url })}
                    />
                  </div>
                </ItemLista>
              );
            })}
            {depoimentos.itens.length < 9 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  atualizar("depoimentos", {
                    itens: [...depoimentos.itens, { nome: "", empresa: "", texto: "", foto: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4" /> Adicionar depoimento
              </Button>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Chamada final" subtitle="O bloco roxo antes do rodapé.">
          <div className="grid gap-4 md:grid-cols-2">
            <Campo label="Título">
              <Input
                value={ctaFinal.titulo}
                onChange={(e) => atualizar("ctaFinal", { titulo: e.target.value })}
              />
            </Campo>
            <Campo label="Texto">
              <Input
                value={ctaFinal.texto}
                onChange={(e) => atualizar("ctaFinal", { texto: e.target.value })}
              />
            </Campo>
            <Campo label="Botão principal (cadastro)">
              <Input
                value={ctaFinal.ctaPrimario}
                onChange={(e) => atualizar("ctaFinal", { ctaPrimario: e.target.value })}
              />
            </Campo>
            <Campo label="Botão secundário (login)">
              <Input
                value={ctaFinal.ctaSecundario}
                onChange={(e) => atualizar("ctaFinal", { ctaSecundario: e.target.value })}
              />
            </Campo>
          </div>
        </SectionCard>

        <SectionCard
          title="Compartilhamento (WhatsApp, redes sociais)"
          subtitle="Imagem que aparece quando alguém compartilha o link do site."
        >
          <ImagemCampo
            label="Imagem de compartilhamento"
            dica="Tamanho ideal 1200×630."
            valor={seo.ogImagem}
            onChange={(url) => atualizar("seo", { ogImagem: url })}
          />
        </SectionCard>

        <div className="flex justify-start">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setConfirmPadrao(true)}
          >
            <RotateCcw className="h-4 w-4" /> Restaurar textos padrão
          </Button>
        </div>
      </div>

      {/* barra de salvar fixa */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {alterado ? "Você tem alterações não salvas." : "Tudo salvo."}
          </p>
          <Button onClick={() => salvar.mutate()} disabled={!alterado || salvar.isPending}>
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar e publicar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPadrao}
        onOpenChange={setConfirmPadrao}
        title="Restaurar os textos padrão?"
        description="Todos os campos voltam ao conteúdo original (fotos e depoimentos são removidos da página). Nada é gravado até você clicar em “Salvar e publicar”."
        confirmLabel="Restaurar"
        destructive
        onConfirm={() => {
          setC(LANDING_PADRAO);
          setAlterado(true);
          setConfirmPadrao(false);
        }}
      />
    </div>
  );
}

function Campo({
  label,
  className,
  children,
}: {
  label: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ItemLista({
  titulo,
  onSubir,
  onDescer,
  onRemover,
  children,
}: {
  titulo: string;
  onSubir: () => void;
  onDescer: () => void;
  onRemover: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold">{titulo}</p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" aria-label="Mover para cima" onClick={onSubir}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mover para baixo" onClick={onDescer}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remover"
            className="text-destructive"
            onClick={onRemover}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

// Lista de textos editada como "um por linha". Guarda o texto bruto enquanto
// digita (para não comer linhas em branco no meio da edição).
function ListaLinhas({
  label,
  valor,
  max,
  onChange,
}: {
  label: string;
  valor: string[];
  max: number;
  onChange: (itens: string[]) => void;
}) {
  const [texto, setTexto] = useState(valor.join("\n"));
  useEffect(() => {
    if (linhas(texto).join("\n") !== valor.join("\n")) setTexto(valor.join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só sincroniza quando o valor muda de fora (restaurar padrão)
  }, [valor]);
  return (
    <Campo label={label}>
      <Textarea
        rows={Math.min(max, Math.max(3, valor.length + 1))}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(linhas(e.target.value).slice(0, max));
        }}
      />
    </Campo>
  );
}

function ImagemCampo({
  label,
  dica,
  valor,
  onChange,
  className,
}: {
  label: string;
  dica?: string;
  valor: string;
  onChange: (url: string) => void;
  className?: string | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const enviar = useMutation({
    mutationFn: enviarImagem,
    onSuccess: (url) => {
      onChange(url);
      toast.success("Foto enviada. Clique em “Salvar e publicar” para colocar no ar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Campo label={label} className={className}>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-3">
        {valor ? (
          <img
            src={valor}
            alt={label}
            className="h-20 max-w-[200px] rounded-lg border border-border object-cover"
          />
        ) : (
          <span className="flex h-20 w-28 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
            Sem foto
          </span>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={TIPOS_IMAGEM.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) enviar.mutate(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={enviar.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {enviar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {valor ? "Trocar foto" : "Enviar foto"}
            </Button>
            {valor && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => onChange("")}
              >
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            )}
          </div>
          {dica && <p className="max-w-sm text-xs text-muted-foreground">{dica}</p>}
        </div>
      </div>
    </Campo>
  );
}
