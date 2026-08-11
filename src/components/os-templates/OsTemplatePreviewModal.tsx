import { useMemo, useState } from "react";
import {
  Minus,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Printer,
  Download,
  Maximize2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  buildSampleOsRenderData,
  renderOsTemplateHtml,
  renderOsTemplatePages,
} from "@/lib/os-template-render";
import { OsTemplateThumbnail } from "./OsTemplateThumbnail";
import { useEmpresaTemplateData } from "./useEmpresaTemplateData";
import type { OsTemplateDbRow } from "./types";

function abrirImpressao(html: string) {
  const janela = window.open("", "_blank", "width=900,height=1000");
  if (!janela) return;
  janela.document.open();
  janela.document.write(
    html.replace("</body>", "<script>window.onload=()=>window.print()<\\/script></body>"),
  );
  janela.document.close();
}

export function OsTemplatePreviewModal({
  open,
  onOpenChange,
  template,
  onEditar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: OsTemplateDbRow | null;
  onEditar: (template: OsTemplateDbRow) => void;
}) {
  const empresa = useEmpresaTemplateData();
  const [scale, setScale] = useState<number | "fit">("fit");
  const [pagina, setPagina] = useState(0);

  const sample = useMemo(() => buildSampleOsRenderData(empresa), [empresa]);
  const paginas = useMemo(
    () => (template ? renderOsTemplatePages(template, sample) : []),
    [template, sample],
  );
  const paginaAtual = Math.min(pagina, Math.max(paginas.length - 1, 0));

  if (!template) return null;
  const tpl = template;

  function ajustarZoom(delta: number) {
    setScale((s) => {
      const atual = s === "fit" ? 1 : s;
      return Math.min(2, Math.max(0.25, Math.round((atual + delta) * 100) / 100));
    });
  }

  function imprimirCompleto() {
    abrirImpressao(renderOsTemplateHtml(tpl, sample));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setScale("fit");
          setPagina(0);
        }
      }}
    >
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center justify-between gap-4 pr-6">
            <span>{template.nome}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 px-6 py-2 border-b border-border shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => ajustarZoom(-0.1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-14 text-center tabular-nums">
              {scale === "fit" ? "Ajuste" : `${Math.round(scale * 100)}%`}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => ajustarZoom(0.1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 ml-1" onClick={() => setScale(1)}>
              100%
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => setScale("fit")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Ajustar à tela
            </Button>
          </div>

          {paginas.length > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={paginaAtual === 0}
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Página {paginaAtual + 1} de {paginas.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={paginaAtual === paginas.length - 1}
                onClick={() => setPagina((p) => Math.min(paginas.length - 1, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-muted/40 flex items-start justify-center p-8">
          {scale === "fit" ? (
            <div className="w-full max-w-2xl">
              <OsTemplateThumbnail
                html={paginas[paginaAtual] ?? ""}
                orientacao={template.orientacao}
                className="rounded-md shadow-lg border border-border"
              />
            </div>
          ) : (
            <OsTemplateThumbnail
              html={paginas[paginaAtual] ?? ""}
              orientacao={template.orientacao}
              scale={scale}
              className="rounded-md shadow-lg border border-border"
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={() => onEditar(tpl)} className="gap-2">
            <Pencil className="h-4 w-4" />
            Editar modelo
          </Button>
          <Button variant="outline" onClick={imprimirCompleto} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={imprimirCompleto} className="gap-2">
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
