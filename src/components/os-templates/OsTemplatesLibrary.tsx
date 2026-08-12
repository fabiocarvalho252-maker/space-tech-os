import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  Eye,
  Copy,
  Pencil,
  Trash2,
  MoreVertical,
  Search,
  FileStack,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { buildSampleOsRenderData, renderOsTemplateHtml } from "@/lib/os-template-render";
import { OsTemplateThumbnail } from "./OsTemplateThumbnail";
import { OsTemplatePreviewModal } from "./OsTemplatePreviewModal";
import { OsTemplateEditorModal } from "./OsTemplateEditorModal";
import { useEmpresaTemplateData } from "./useEmpresaTemplateData";
import { useEmpresaTermosData } from "./useEmpresaTermosData";
import { CATEGORIA_LABEL, CATEGORIAS, type OsTemplateDbRow } from "./types";

function TemplateCard({
  template,
  sample,
  onPreview,
  onEditar,
  onUsar,
  onFavoritar,
  onDefinirPadrao,
  onDuplicar,
  onExcluir,
}: {
  template: OsTemplateDbRow;
  sample: ReturnType<typeof buildSampleOsRenderData>;
  onPreview: () => void;
  onEditar: () => void;
  onUsar: () => void;
  onFavoritar: () => void;
  onDefinirPadrao: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}) {
  const html = useMemo(() => renderOsTemplateHtml(template, sample), [template, sample]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden flex flex-col group">
      {/* A <button> (Favoritar) can't nest inside another <button> — invalid
          HTML that React logs as a hydration warning and that browsers
          "fix" by closing the outer button early, leaving the click target
          inconsistent. This div fills the same role (click-to-preview,
          keyboard-activatable) without nesting interactive elements. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onPreview}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPreview();
          }
        }}
        className="relative block w-full cursor-pointer border-b border-border bg-muted/30"
      >
        <OsTemplateThumbnail html={html} orientacao={template.orientacao} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-foreground">
            <Eye className="h-4 w-4" />
            Ver prévia
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFavoritar();
          }}
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/90 flex items-center justify-center shadow"
          title={template.favorito ? "Remover dos favoritos" : "Favoritar"}
        >
          <Star
            className={`h-4 w-4 ${template.favorito ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        </button>
        {template.padrao && (
          <Badge className="absolute top-2 left-2 gap-1 bg-primary text-primary-foreground">
            <CheckCircle2 className="h-3 w-3" />
            Padrão
          </Badge>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-sm truncate">{template.nome}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {template.descricao || "Sem descrição."}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditar}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicar}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              {!template.padrao && (
                <DropdownMenuItem onClick={onDefinirPadrao}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Definir como padrão
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onExcluir}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px]">
            {CATEGORIA_LABEL[template.categoria] ?? template.categoria}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {template.paginas} {template.paginas === 1 ? "página" : "páginas"}
          </Badge>
          <Badge variant="outline" className="text-[10px] capitalize">
            {template.orientacao}
          </Badge>
        </div>

        <div className="flex gap-2 mt-auto pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Prévia
          </Button>
          <Button size="sm" className="flex-1" onClick={onUsar}>
            Usar modelo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OsTemplatesLibrary() {
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const qc = useQueryClient();
  const empresa = useEmpresaTemplateData();
  const termos = useEmpresaTermosData();
  const sample = useMemo(() => buildSampleOsRenderData(empresa, termos), [empresa, termos]);

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [paginasFiltro, setPaginasFiltro] = useState("todas");
  const [orientacaoFiltro, setOrientacaoFiltro] = useState("todas");

  const [previewTemplate, setPreviewTemplate] = useState<OsTemplateDbRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<OsTemplateDbRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [usarTemplate, setUsarTemplate] = useState<OsTemplateDbRow | null>(null);
  const [excluirTemplate, setExcluirTemplate] = useState<OsTemplateDbRow | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["os-templates", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_templates" as any)
        .select("*")
        .eq("user_id", empresaId!)
        .eq("ativo", true)
        // The 6 seed templates are inserted in one statement, so they all
        // get the exact same created_at (now() is evaluated once per
        // statement) — without a tiebreaker, Postgres can return them in a
        // different order after any UPDATE relocates a row, making cards
        // jump around the grid. `id` has no ties, so it keeps the order
        // stable across edits.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      return data as unknown as OsTemplateDbRow[];
    },
  });

  // First visit for this empresa: seed the 6 starter templates, then load
  // the real list — matches how every other lazily-seeded config screen in
  // this app self-heals instead of depending on the signup trigger.
  const seedTentadoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!empresaId || isLoading || seedTentadoRef.current === empresaId) return;
    if (templates && templates.length === 0) {
      seedTentadoRef.current = empresaId;
      supabase
        .rpc("garantir_templates_padrao" as any, { p_user_id: empresaId })
        .then(({ error }) => {
          if (error) {
            toast.error("Não foi possível carregar os modelos padrão: " + error.message);
            return;
          }
          qc.invalidateQueries({ queryKey: ["os-templates", empresaId] });
        });
    }
  }, [empresaId, isLoading, templates, qc]);

  const favoritar = useMutation({
    mutationFn: async (t: OsTemplateDbRow) => {
      const { error } = await supabase
        .from("os_templates" as any)
        .update({ favorito: !t.favorito })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["os-templates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const definirPadrao = useMutation({
    mutationFn: async (t: OsTemplateDbRow) => {
      const { error } = await supabase.rpc("definir_template_padrao" as any, {
        p_template_id: t.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo definido como padrão para impressão e PDF.");
      qc.invalidateQueries({ queryKey: ["os-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicar = useMutation({
    mutationFn: async (t: OsTemplateDbRow) => {
      const { data, error } = await supabase
        .from("os_templates" as any)
        .insert({
          user_id: empresaId!,
          nome: `${t.nome} — Cópia`,
          descricao: t.descricao,
          categoria: t.categoria,
          orientacao: t.orientacao,
          paginas: t.paginas,
          tema: t.tema,
          config: t.config,
          builtin: false,
          created_by: user!.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as OsTemplateDbRow;
    },
    onSuccess: (novo) => {
      qc.invalidateQueries({ queryKey: ["os-templates"] });
      return novo;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (t: OsTemplateDbRow) => {
      const { error } = await supabase
        .from("os_templates" as any)
        .update({ ativo: false })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo excluído.");
      qc.invalidateQueries({ queryKey: ["os-templates"] });
      setExcluirTemplate(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lista = useMemo(() => {
    let base = templates ?? [];
    if (categoria !== "todos") base = base.filter((t) => t.categoria === categoria);
    if (paginasFiltro !== "todas") base = base.filter((t) => t.paginas === Number(paginasFiltro));
    if (orientacaoFiltro !== "todas") base = base.filter((t) => t.orientacao === orientacaoFiltro);
    if (busca.trim()) {
      const b = busca.toLowerCase();
      base = base.filter(
        (t) => t.nome.toLowerCase().includes(b) || (t.descricao ?? "").toLowerCase().includes(b),
      );
    }
    return [...base].sort((a, b) => {
      if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
      if (a.padrao !== b.padrao) return a.padrao ? -1 : 1;
      return 0;
    });
  }, [templates, categoria, paginasFiltro, orientacaoFiltro, busca]);

  function handleUsarModelo(t: OsTemplateDbRow) {
    duplicar.mutate(t, {
      onSuccess: (novo) => {
        setUsarTemplate(null);
        toast.success("Cópia criada! Personalize o modelo abaixo.");
        setEditorTemplate(novo);
        setEditorOpen(true);
      },
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2 mb-1">
          <FileStack className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Biblioteca de modelos</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Escolha um modelo pronto para começar sua Ordem de Serviço e personalize à vontade. O
          modelo marcado como <strong>Padrão</strong> é o usado automaticamente na impressão e no
          PDF da OS.
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar modelo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={paginasFiltro} onValueChange={setPaginasFiltro}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as páginas</SelectItem>
                <SelectItem value="1">1 página</SelectItem>
                <SelectItem value="2">2 páginas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orientacaoFiltro} onValueChange={setOrientacaoFiltro}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Retrato e paisagem</SelectItem>
                <SelectItem value="retrato">A4 Retrato</SelectItem>
                <SelectItem value="paisagem">A4 Paisagem</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={categoria === "todos" ? "default" : "outline"}
              onClick={() => setCategoria("todos")}
              className="rounded-full h-7 text-xs"
            >
              Todos
            </Button>
            {CATEGORIAS.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={categoria === c ? "default" : "outline"}
                onClick={() => setCategoria(c)}
                className="rounded-full h-7 text-xs"
              >
                {CATEGORIA_LABEL[c]}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Nenhum modelo encontrado com esses filtros.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              sample={sample}
              onPreview={() => {
                setPreviewTemplate(t);
                setPreviewOpen(true);
              }}
              onEditar={() => {
                setEditorTemplate(t);
                setEditorOpen(true);
              }}
              onUsar={() => setUsarTemplate(t)}
              onFavoritar={() => favoritar.mutate(t)}
              onDefinirPadrao={() => definirPadrao.mutate(t)}
              onDuplicar={() =>
                duplicar.mutate(t, { onSuccess: () => toast.success("Modelo duplicado!") })
              }
              onExcluir={() => setExcluirTemplate(t)}
            />
          ))}
        </div>
      )}

      <OsTemplatePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        template={previewTemplate}
        onEditar={(t) => {
          setPreviewOpen(false);
          setEditorTemplate(t);
          setEditorOpen(true);
        }}
      />

      <OsTemplateEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editorTemplate}
      />

      <ConfirmDialog
        open={!!usarTemplate}
        onOpenChange={(v) => !v && setUsarTemplate(null)}
        title="Usar este modelo?"
        description="Uma cópia será criada para você personalizar. O modelo original não será alterado."
        confirmLabel="Usar modelo"
        loading={duplicar.isPending}
        onConfirm={() => usarTemplate && handleUsarModelo(usarTemplate)}
      />

      <ConfirmDialog
        open={!!excluirTemplate}
        onOpenChange={(v) => !v && setExcluirTemplate(null)}
        title="Excluir modelo?"
        description={`"${excluirTemplate?.nome}" será removido da sua biblioteca. Essa ação não afeta OSs já impressas.`}
        confirmLabel="Excluir"
        destructive
        loading={excluir.isPending}
        onConfirm={() => excluirTemplate && excluir.mutate(excluirTemplate)}
      />
    </div>
  );
}
