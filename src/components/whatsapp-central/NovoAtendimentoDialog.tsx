import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClienteSelect } from "@/components/ClienteSelect";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { isValidPhoneBR, maskPhoneBR } from "@/lib/whatsapp";
import { iniciarConversaFn } from "@/lib/whatsapp/central.functions";
import { mensagemDeErro } from "./util";

/** Começa uma conversa com um cliente cadastrado ou um número qualquer. */
export function NovoAtendimentoDialog({
  open,
  onOpenChange,
  onCriada,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriada: (conversaId: string) => void;
}) {
  const qc = useQueryClient();
  const empresaId = useEmpresaId();
  const [clienteId, setClienteId] = useState("");
  const [telefone, setTelefone] = useState("");
  const [texto, setTexto] = useState("");

  const clientes = useQuery({
    queryKey: ["clientes-telefone", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone")
        .eq("user_id", empresaId!)
        .order("nome")
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!empresaId,
  });

  const iniciar = useMutation({
    mutationFn: () => iniciarConversaFn({ data: { numero: telefone, texto } }),
    onSuccess: ({ conversaId }) => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-central"] });
      setClienteId("");
      setTelefone("");
      setTexto("");
      onOpenChange(false);
      onCriada(conversaId);
    },
    onError: (e) => toast.error(mensagemDeErro(e)),
  });

  const valido = isValidPhoneBR(telefone) && !!texto.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !iniciar.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo atendimento</DialogTitle>
          <DialogDescription>
            Envie a primeira mensagem para um cliente. A conversa fica atribuída a você.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente (opcional)</Label>
            <ClienteSelect
              clientes={clientes.data ?? []}
              value={clienteId}
              semClienteLabel="Digitar só o número"
              onChange={(id) => {
                setClienteId(id);
                const c = clientes.data?.find((x) => x.id === id);
                if (c?.telefone) setTelefone(maskPhoneBR(c.telefone));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-telefone">WhatsApp</Label>
            <Input
              id="novo-telefone"
              value={telefone}
              onChange={(e) => setTelefone(maskPhoneBR(e.target.value))}
              placeholder="(74) 99999-9999"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="novo-texto">Mensagem</Label>
            <Textarea
              id="novo-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              maxLength={4096}
              placeholder="Olá! Aqui é da assistência…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={iniciar.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={() => iniciar.mutate()} disabled={!valido || iniciar.isPending}>
            {iniciar.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
