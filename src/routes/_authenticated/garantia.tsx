import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/garantia")({
  head: () => ({
    meta: [
      { title: "Termos de Garantia — SpaceTech" },
      { name: "description", content: "Gerencie seus termos de garantia para Ordens de Serviço." },
    ],
  }),
  component: Garantia,
});

function Garantia() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: "", conteudo: "", is_default: false });

  const { data: termos = [], isLoading } = useQuery({
    queryKey: ["termos_garantia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termos_garantia")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      const payload = {
        ...form,
        user_id: user.id,
      };

      if (editId) {
        const { error } = await supabase
          .from("termos_garantia")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        // Se for o primeiro termo, marcar como default
        if (termos.length === 0) payload.is_default = true;
        
        const { error } = await supabase
          .from("termos_garantia")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["termos_garantia"] });
      toast.success(editId ? "Termo atualizado!" : "Novo termo criado!");
      setOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast.error("Erro ao salvar termo: " + err.message);
    },
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("termos_garantia").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["termos_garantia"] });
      toast.success("Termo removido!");
    },
  });

  const tornarPadrao = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro tira o padrão de todos
      await supabase.from("termos_garantia").update({ is_default: false }).eq("user_id", user?.id || "");
      // Depois define o novo padrão
      const { error } = await supabase.from("termos_garantia").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["termos_garantia"] });
      toast.success("Termo definido como padrão!");
    },
  });

  function resetForm() {
    setForm({ titulo: "", conteudo: "", is_default: false });
    setEditId(null);
  }

  function handleEdit(termo: any) {
    setEditId(termo.id);
    setForm({ titulo: termo.titulo, conteudo: termo.conteudo, is_default: termo.is_default });
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Termos de Garantia"
        subtitle="Configure as cláusulas de garantia que aparecerão nos seus comprovantes de OS."
        action={
          <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Novo Termo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Termo" : "Novo Termo de Garantia"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Título do Termo</Label>
                  <Input 
                    placeholder="Ex: Garantia Padrão (90 dias)" 
                    value={form.titulo}
                    onChange={(e) => setForm({...form, titulo: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo das Cláusulas</Label>
                  <Textarea 
                    placeholder="Descreva aqui os termos da garantia..."
                    className="min-h-[200px] resize-none"
                    value={form.conteudo}
                    onChange={(e) => setForm({...form, conteudo: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : "Salvar Termo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando termos...</p>
        ) : termos.length > 0 ? (
          termos.map((termo) => (
            <div 
              key={termo.id} 
              className={`relative rounded-2xl border p-5 shadow-soft transition-all bg-card ${
                termo.is_default ? "border-primary ring-1 ring-primary/20" : "border-border"
              }`}
            >
              {termo.is_default && (
                <div className="absolute -top-3 left-4 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground uppercase tracking-wider">
                  <CheckCircle2 className="h-3 w-3" /> Padrão
                </div>
              )}
              
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-lg">{termo.titulo}</h3>
                  <p className="mt-2 line-clamp-4 text-sm text-muted-foreground whitespace-pre-line">
                    {termo.conteudo}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(termo)}>
                    Editar
                  </Button>
                  {!termo.is_default && (
                    <Button variant="ghost" size="sm" className="text-primary" onClick={() => tornarPadrao.mutate(termo.id)}>
                      Definir Padrão
                    </Button>
                  )}
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if(confirm("Tem certeza que deseja excluir este termo?")) remover.mutate(termo.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Sem termos de garantia</h3>
            <p className="mx-auto max-w-xs text-sm mt-1">
              Crie termos de garantia personalizados para aparecerem automaticamente nos seus comprovantes.
            </p>
          </div>
        )}
      </div>

      <div className="mt-12 rounded-2xl bg-primary/5 p-6 border border-primary/10">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 text-primary shrink-0" />
          <div>
            <h4 className="font-bold text-primary">Como funciona?</h4>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              O termo definido como <strong>Padrão</strong> será impresso automaticamente em todas as suas Ordens de Serviço. 
              Você pode criar diferentes termos (ex: Garantia de Tela, Garantia de Software) e trocá-los conforme a necessidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
