import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  excluirRespostaRapidaFn,
  respostasRapidasFn,
  salvarRespostaRapidaFn,
} from "@/lib/whatsapp/central.functions";
import { QK, mensagemDeErro } from "./util";

export function RespostasRapidasDialog({
  open,
  onOpenChange,
  podeEditar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<string | undefined>(undefined);
  const [atalho, setAtalho] = useState("");
  const [texto, setTexto] = useState("");

  const lista = useQuery({
    queryKey: QK.respostas,
    queryFn: () => respostasRapidasFn(),
    enabled: open,
  });

  function limpar() {
    setEditando(undefined);
    setAtalho("");
    setTexto("");
  }

  const salvar = useMutation({
    mutationFn: () => salvarRespostaRapidaFn({ data: { id: editando, atalho, texto } }),
    onSuccess: () => {
      toast.success("Resposta rápida salva.");
      limpar();
      void qc.invalidateQueries({ queryKey: QK.respostas });
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => excluirRespostaRapidaFn({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QK.respostas }),
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) limpar();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Respostas rápidas</DialogTitle>
          <DialogDescription>
            Na conversa, digite <strong>/</strong> e o atalho. Use <strong>{"{nome}"}</strong> para
            o primeiro nome do cliente.
          </DialogDescription>
        </DialogHeader>

        {podeEditar && (
          <form
            className="space-y-3 rounded-xl border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rr-atalho">Atalho</Label>
              <Input
                id="rr-atalho"
                value={atalho}
                onChange={(e) =>
                  setAtalho(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                }
                placeholder="ex.: horario"
                maxLength={30}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rr-texto">Mensagem</Label>
              <Textarea
                id="rr-texto"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                maxLength={4096}
                placeholder="Olá {nome}! Funcionamos de segunda a sábado, das 8h às 18h."
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              {editando && (
                <Button type="button" variant="ghost" onClick={limpar}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" disabled={salvar.isPending || !atalho || !texto.trim()}>
                {salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {editando ? "Salvar alteração" : "Adicionar"}
              </Button>
            </div>
          </form>
        )}

        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {lista.isLoading && <Loader2 className="mx-auto h-4 w-4 animate-spin" />}
          {lista.data?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Nenhuma resposta rápida ainda.
            </p>
          )}
          {lista.data?.map((r) => (
            <li key={r.id} className="flex gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-primary">/{r.atalho}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{r.texto}</p>
              </div>
              {podeEditar && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Editar /${r.atalho}`}
                    onClick={() => {
                      setEditando(r.id);
                      setAtalho(r.atalho);
                      setTexto(r.texto);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    aria-label={`Excluir /${r.atalho}`}
                    onClick={() => excluir.mutate(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
