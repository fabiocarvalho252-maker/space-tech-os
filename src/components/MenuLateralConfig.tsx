// Configurações → Menu: ordem do menu lateral de cada login (automática pelo
// uso ou manual com setas). Salvo em profiles.menu_preferencias.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Lock, RotateCcw, Sparkles, Hand } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissoes, useProfile, podeVer } from "@/hooks/useCurrentUser";
import {
  NAV,
  lerMenuPreferencias,
  lerUsoMenu,
  ordenarMenu,
  type ItemNav,
  type MenuPreferencias,
} from "@/lib/menu-lateral";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MenuLateralConfig() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const { data: profile } = useProfile();
  const { data: permissoes } = usePermissoes();

  const salvo = useMemo(
    () => lerMenuPreferencias(profile?.menu_preferencias),
    [profile?.menu_preferencias],
  );
  const [modo, setModo] = useState<MenuPreferencias["modo"]>(salvo.modo);
  const [ordem, setOrdem] = useState<string[]>([]);
  const [uso, setUso] = useState<Record<string, number>>({});

  const visiveis = useMemo(
    () => NAV.filter((i) => !i.modulo || podeVer(permissoes, i.modulo)),
    [permissoes],
  );

  // Ponto de partida da lista manual: a ordem salva, ou a que o menu mostra
  // hoje (automática), para a pessoa só ajustar o que quiser.
  useEffect(() => {
    const u = lerUsoMenu();
    setUso(u);
    setModo(salvo.modo);
    setOrdem(
      ordenarMenu(visiveis, salvo.modo === "manual" ? salvo : { modo: "auto", ordem: [] }, u)
        .map((i) => i.to)
        .filter((to) => to !== "/dashboard"),
    );
  }, [salvo, visiveis]);

  const porRota = new Map<string, ItemNav>(visiveis.map((i) => [i.to, i]));
  const painel = porRota.get("/dashboard");

  function mover(idx: number, delta: number) {
    setOrdem((atual) => {
      const alvo = idx + delta;
      if (alvo < 0 || alvo >= atual.length) return atual;
      const nova = [...atual];
      [nova[idx], nova[alvo]] = [nova[alvo]!, nova[idx]!];
      return nova;
    });
  }

  const salvar = useMutation({
    mutationFn: async (prefs: MenuPreferencias) => {
      if (!user) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("profiles")
        .update({ menu_preferencias: prefs })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Ordem do menu salva.");
    },
    onError: (e: Error) => toast.error("Erro ao salvar: " + e.message),
  });

  const ordemAuto = ordenarMenu(visiveis, { modo: "auto", ordem: [] }, uso)
    .map((i) => i.to)
    .filter((to) => to !== "/dashboard");
  const lista = modo === "manual" ? ordem : ordemAuto;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: "auto",
              icon: Sparkles,
              titulo: "Automática",
              texto: "As telas que você mais abre sobem sozinhas.",
            },
            {
              id: "manual",
              icon: Hand,
              titulo: "Manual",
              texto: "Você escolhe o lugar de cada item com as setas.",
            },
          ] as const
        ).map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => setModo(op.id)}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-left transition-all",
              modo === op.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/40",
            )}
          >
            <op.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{op.titulo}</p>
              <p className="text-sm text-muted-foreground">{op.texto}</p>
            </div>
          </button>
        ))}
      </div>

      <ol className="space-y-1.5">
        {painel && (
          <li className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            <span className="w-5 text-right text-xs">1</span>
            <painel.icon className="h-4 w-4" />
            <span className="flex-1">{painel.label}</span>
            <Lock className="h-3.5 w-3.5" aria-label="Sempre primeiro" />
          </li>
        )}
        {lista.map((to, idx) => {
          const item = porRota.get(to);
          if (!item) return null;
          return (
            <li
              key={to}
              className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-1.5 text-sm"
            >
              <span className="w-5 text-right text-xs text-muted-foreground">{idx + 2}</span>
              <item.icon className="h-4 w-4 text-primary" />
              <span className="flex-1 font-medium">{item.label}</span>
              {modo === "auto" ? (
                <span className="text-xs text-muted-foreground">
                  {uso[to] ? `${uso[to]} acesso${uso[to] > 1 ? "s" : ""}` : "—"}
                </span>
              ) : (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={idx === 0}
                    onClick={() => mover(idx, -1)}
                    aria-label={`Subir ${item.label}`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    disabled={idx === lista.length - 1}
                    onClick={() => mover(idx, 1)}
                    aria-label={`Descer ${item.label}`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap justify-end gap-2">
        {modo === "manual" && (
          <Button type="button" variant="outline" onClick={() => setOrdem(ordemAuto)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Começar pela ordem de uso
          </Button>
        )}
        <Button
          type="button"
          disabled={salvar.isPending}
          onClick={() => salvar.mutate(modo === "manual" ? { modo, ordem } : { modo, ordem: [] })}
        >
          {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar ordem do menu
        </Button>
      </div>
    </div>
  );
}
