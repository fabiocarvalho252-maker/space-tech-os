import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildSampleOsRenderData,
  renderOsTemplateHtml,
  SECAO_LABEL,
  TEMA_LABEL,
  type OsTemplateConfig,
  type OsTemplateFotosLayout,
  type OsTemplateOrientacao,
  type OsTemplateSecao,
  type OsTemplateTema,
} from "@/lib/os-template-render";
import { OsTemplateThumbnail } from "./OsTemplateThumbnail";
import { useEmpresaTemplateData } from "./useEmpresaTemplateData";
import { CATEGORIA_LABEL, CATEGORIAS, type OsTemplateDbRow } from "./types";

const TODAS_SECOES = Object.keys(SECAO_LABEL) as OsTemplateSecao[];
const SECOES_OBRIGATORIAS: OsTemplateSecao[] = ["cabecalho", "valores"];
const TEMAS: OsTemplateTema[] = ["roxo", "azul", "verde", "preto", "vermelho", "minimalista"];
const TEMA_SWATCH: Record<OsTemplateTema, string> = {
  azul: "#2563eb",
  verde: "#16a34a",
  roxo: "#4f46e5",
  preto: "#111827",
  vermelho: "#dc2626",
  minimalista: "#374151",
};
const FOTOS_LAYOUT_LABEL: Record<OsTemplateFotosLayout, string> = {
  "0": "Sem fotos",
  "2": "2 fotos",
  "4": "4 fotos",
  "6": "6 fotos",
  grande: "Fotos grandes",
};

export function OsTemplateEditorModal({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: OsTemplateDbRow | null;
  onSaved?: (t: OsTemplateDbRow) => void;
}) {
  const qc = useQueryClient();
  const empresa = useEmpresaTemplateData();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("profissional");
  const [orientacao, setOrientacao] = useState<OsTemplateOrientacao>("retrato");
  const [paginas, setPaginas] = useState(1);
  const [tema, setTema] = useState<OsTemplateTema>("roxo");
  const [secoes, setSecoes] = useState<OsTemplateSecao[]>([]);
  const [fotosLayout, setFotosLayout] = useState<OsTemplateFotosLayout>("4");

  useEffect(() => {
    if (!template || !open) return;
    setNome(template.nome);
    setDescricao(template.descricao ?? "");
    setCategoria(template.categoria);
    setOrientacao(template.orientacao);
    setPaginas(template.paginas);
    setTema(template.tema);
    setSecoes(template.config.secoes);
    setFotosLayout(template.config.fotos_layout);
  }, [template, open]);

  // paginas=1 can't carry a "quebra_pagina" marker section — drop it the
  // moment the user switches back, instead of silently keeping a dead
  // section that would never render.
  useEffect(() => {
    if (paginas === 1) setSecoes((s) => s.filter((sec) => sec !== "quebra_pagina"));
  }, [paginas]);

  function alternarSecao(secao: OsTemplateSecao) {
    if (SECOES_OBRIGATORIAS.includes(secao)) return;
    setSecoes((s) => (s.includes(secao) ? s.filter((x) => x !== secao) : [...s, secao]));
  }

  function moverSecao(secao: OsTemplateSecao, dir: -1 | 1) {
    setSecoes((s) => {
      const i = s.indexOf(secao);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const novo = [...s];
      [novo[i], novo[j]] = [novo[j]!, novo[i]!];
      return novo;
    });
  }

  const config: OsTemplateConfig = useMemo(
    () => ({
      secoes: Array.from(new Set([...SECOES_OBRIGATORIAS, ...secoes])),
      fotos_layout: fotosLayout,
    }),
    [secoes, fotosLayout],
  );

  const previewHtml = useMemo(() => {
    if (!template) return "";
    const sample = buildSampleOsRenderData(empresa);
    return renderOsTemplateHtml({ ...template, orientacao, tema, config }, sample);
  }, [template, empresa, orientacao, tema, config]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("Nenhum modelo selecionado.");
      const { data, error } = await supabase
        .from("os_templates" as any)
        .update({
          nome,
          descricao: descricao || null,
          categoria,
          orientacao,
          paginas,
          tema,
          config,
          updated_at: new Date().toISOString(),
        })
        .eq("id", template.id)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as OsTemplateDbRow;
    },
    onSuccess: (data) => {
      toast.success("Modelo salvo!");
      qc.invalidateQueries({ queryKey: ["os-templates"] });
      onSaved?.(data);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!template) return null;
  const ordenadas = secoes.filter((s) => TODAS_SECOES.includes(s));
  const disponiveis = TODAS_SECOES.filter(
    (s) =>
      !ordenadas.includes(s) &&
      !SECOES_OBRIGATORIAS.includes(s) &&
      (paginas === 2 || s !== "quebra_pagina"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar modelo</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-[380px_1fr] gap-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="min-h-[70px]"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORIA_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor do modelo</Label>
              <div className="flex flex-wrap gap-2">
                {TEMAS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    title={TEMA_LABEL[t]}
                    onClick={() => setTema(t)}
                    className={`h-8 w-8 rounded-full border-2 transition ${tema === t ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ background: TEMA_SWATCH[t] }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orientação</Label>
                <div className="flex gap-1">
                  {(["retrato", "paisagem"] as const).map((o) => (
                    <Button
                      key={o}
                      type="button"
                      size="sm"
                      variant={orientacao === o ? "default" : "outline"}
                      onClick={() => setOrientacao(o)}
                      className="flex-1"
                    >
                      {o === "retrato" ? "Retrato" : "Paisagem"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Páginas</Label>
                <div className="flex gap-1">
                  {[1, 2].map((p) => (
                    <Button
                      key={p}
                      type="button"
                      size="sm"
                      variant={paginas === p ? "default" : "outline"}
                      onClick={() => setPaginas(p)}
                      className="flex-1"
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {ordenadas.includes("fotos") && (
              <div className="space-y-2">
                <Label>Layout de fotos</Label>
                <Select
                  value={fotosLayout}
                  onValueChange={(v) => setFotosLayout(v as OsTemplateFotosLayout)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FOTOS_LAYOUT_LABEL).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Seções incluídas (ordem de impressão)</Label>
              <div className="space-y-1">
                {SECOES_OBRIGATORIAS.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <span>{SECAO_LABEL[s]}</span>
                    <span className="text-xs text-muted-foreground">obrigatória</span>
                  </div>
                ))}
                {ordenadas.map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span>{SECAO_LABEL[s]}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={i === 0}
                        onClick={() => moverSecao(s, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        disabled={i === ordenadas.length - 1}
                        onClick={() => moverSecao(s, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => alternarSecao(s)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {disponiveis.length > 0 && (
              <div className="space-y-2">
                <Label>Adicionar seção</Label>
                <div className="flex flex-wrap gap-2">
                  {disponiveis.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => alternarSecao(s)}
                      className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary transition"
                    >
                      + {SECAO_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-muted/40 rounded-xl flex items-start justify-center p-8 md:sticky md:top-0 md:self-start">
            <div className="w-full max-w-xl">
              <OsTemplateThumbnail
                html={previewHtml}
                orientacao={orientacao}
                className="rounded-md shadow-lg border border-border"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !nome.trim()}>
            {salvar.isPending ? "Salvando..." : "Salvar modelo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
