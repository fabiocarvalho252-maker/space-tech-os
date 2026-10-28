import { BellOff, Bot } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CATEGORIAS_ASSISTENTE, fimDoDia, silenciado } from "@/lib/assistente/sugestoes";
import { usePreferenciasAssistente } from "./useAssistente";

// Liga/desliga do assistente — usado no painel da IA e em Configurações.
export function PreferenciasAssistente({ compacto = false }: { compacto?: boolean }) {
  const { prefs, salvar } = usePreferenciasAssistente();
  const quieto = silenciado(prefs);

  function alternarCategoria(id: string, ver: boolean) {
    const desligadas = new Set(prefs.categorias_desligadas);
    if (ver) desligadas.delete(id);
    else desligadas.add(id);
    salvar({ categorias_desligadas: [...desligadas] });
  }

  return (
    <div className={compacto ? "space-y-4" : "space-y-5"}>
      <label className="flex items-start justify-between gap-4">
        <span className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Assistente {prefs.ativo ? "ligado" : "desligado"}
            </span>
            <span className="block text-xs text-muted-foreground">
              Avisa sobre OS paradas, cobranças, estoque e agenda, e pergunta se você quer resolver.
              Não usa a IA nem o limite diário.
            </span>
          </span>
        </span>
        <Switch
          checked={prefs.ativo}
          onCheckedChange={(ativo) => salvar({ ativo })}
          aria-label="Ligar ou desligar o assistente"
        />
      </label>

      {prefs.ativo && (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              O que ele pode avisar
            </p>
            <div className={compacto ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
              {CATEGORIAS_ASSISTENTE.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={!prefs.categorias_desligadas.includes(c.id)}
                    onCheckedChange={(v) => alternarCategoria(c.id, v === true)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quieto ? (
              <Button variant="outline" size="sm" onClick={() => salvar({ silenciado_ate: null })}>
                Voltar a avisar agora
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => salvar({ silenciado_ate: fimDoDia().toISOString() })}
              >
                <BellOff className="h-3.5 w-3.5" /> Silenciar por hoje
              </Button>
            )}
            {Object.keys(prefs.dispensados).length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => salvar({ dispensados: {} })}>
                Mostrar de novo os avisos dispensados
              </Button>
            )}
          </div>
          {quieto && (
            <p className="text-xs text-muted-foreground">
              Silenciado até o fim do dia: sem balão nem contador. A lista de sugestões continua
              aqui no painel.
            </p>
          )}
        </>
      )}
    </div>
  );
}
