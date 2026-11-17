import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { EstadoMissao } from "../estado.ts";
import type { StatusMissao } from "../tipos.ts";
import { avisoDaTransicao, gravarPreferenciaSom, lerPreferenciaSom, tocarAviso } from "../som.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROTULO_STATUS: Record<StatusMissao, string> = {
  ocioso: "Sem missão",
  rodando: "Em andamento",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};

const COR_STATUS: Record<StatusMissao, string> = {
  ocioso: "border-border text-muted-foreground",
  rodando: "border-primary/40 bg-primary/15 text-primary",
  concluida: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  falhou: "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-300",
  cancelada: "border-zinc-500/40 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

function useSomAvisos(estado: EstadoMissao): [boolean, (ativo: boolean) => void] {
  const [somAtivo, setSomAtivo] = useState(false);
  const anteriorRef = useRef<EstadoMissao>(estado);

  // Lê a preferência só depois de montar, para o HTML do servidor bater com o cliente.
  useEffect(() => {
    setSomAtivo(lerPreferenciaSom());
  }, []);

  useEffect(() => {
    const anterior = anteriorRef.current;
    anteriorRef.current = estado;
    if (!somAtivo) return;
    const aviso = avisoDaTransicao(anterior, estado);
    if (aviso) tocarAviso(aviso);
  }, [estado, somAtivo]);

  const alternar = (ativo: boolean) => {
    gravarPreferenciaSom(ativo);
    setSomAtivo(ativo);
  };
  return [somAtivo, alternar];
}

export function OfficeToolbar({ estado }: { estado: EstadoMissao }) {
  const ativos = estado.ordem.filter((id) => estado.agentes[id]?.estado !== "ocioso").length;
  const [somAtivo, alternarSom] = useSomAvisos(estado);
  const IconeSom = somAtivo ? Volume2 : VolumeX;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className={cn("rounded-full border px-3 py-1 font-semibold", COR_STATUS[estado.status])}
      >
        {ROTULO_STATUS[estado.status]}
      </span>
      <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
        {ativos} agente(s) ativo(s)
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-2"
        aria-pressed={somAtivo}
        onClick={() => alternarSom(!somAtivo)}
      >
        <IconeSom className="h-4 w-4" aria-hidden="true" />
        Avisos sonoros: {somAtivo ? "ligados" : "desligados"}
      </Button>
    </div>
  );
}
