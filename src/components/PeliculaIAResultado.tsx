import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import type { SugestaoPelicula } from "@/lib/peliculas.functions";
import { Button } from "@/components/ui/button";

// Shared by /ferramentas and /ia-spacetech. Render it with a `key` that
// changes per answer so the "salvo" state resets on every new query.
export function PeliculaIAResultado({ resultado }: { resultado: SugestaoPelicula }) {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "produtos");

  // Saves the answer straight into the catalog so the next search for any
  // of those phones is answered locally, without spending another credit.
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("peliculas_catalogo").insert({
        user_id: empresaId!,
        marca: resultado.marca || "—",
        modelo: resultado.modelo,
        codigo: "",
        pelicula_compativel: resultado.pelicula_compativel || resultado.compativeis.join(" / "),
        observacoes: [
          resultado.compativeis.length ? `Compatível com: ${resultado.compativeis.join(", ")}` : "",
          resultado.observacoes,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salvo no catálogo");
      qc.invalidateQueries({ queryKey: ["peliculas-catalogo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Sparkles className="h-4 w-4 text-primary" /> Resposta da IA
      </h2>
      <div className="mt-3 space-y-3">
        {resultado.pelicula_compativel && (
          <div>
            <p className="text-xs font-bold uppercase text-primary">Película</p>
            <p className="text-base font-bold">{resultado.pelicula_compativel}</p>
          </div>
        )}
        {resultado.compativeis.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase text-primary">
              <Target className="h-3 w-3" /> Serve nos modelos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {resultado.compativeis.map((m) => (
                <span
                  key={m}
                  className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs font-medium"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
        {resultado.observacoes && (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            {resultado.observacoes}
          </p>
        )}
        {resultado.fontes.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-primary">Fontes pesquisadas</p>
            <ul className="space-y-0.5">
              {resultado.fontes.map((f) => (
                <li key={f.url} className="truncate text-xs">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {f.titulo || f.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Sugestão da IA — confira na bancada antes de aplicar.
        </p>
        {gerenciar && resultado.compativeis.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || salvar.isSuccess}
          >
            <Save className="h-4 w-4" /> {salvar.isSuccess ? "Salvo" : "Salvar no catálogo"}
          </Button>
        )}
      </div>
    </div>
  );
}
