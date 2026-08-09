import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Plus, Trash2, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços — SpaceTech" },
      { name: "description", content: "Gerenciamento de serviços técnicos e mão de obra." },
    ],
  }),
  component: Servicos,
});

const vazio = {
  nome: "",
  preco_custo: "0",
  preco_venda: "0",
  categoria: "Serviço",
};

function Servicos() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(vazio);

  const { data: servicos = [] } = useQuery({
    queryKey: ["servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("categoria", "Serviço")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do serviço");
      if (Number(form.preco_venda) <= 0) throw new Error("O preço de venda deve ser maior que zero");

      const { error } = await supabase.from("produtos").insert({
        user_id: user!.id,
        nome: form.nome,
        categoria: "Serviço",
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        quantidade: 999, // Serviços não têm estoque real
        estoque_minimo: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço cadastrado");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["servicos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido");
      qc.invalidateQueries({ queryKey: ["servicos"] });
    },
  });

  const filtrados = useMemo(() => {
    return servicos.filter(s => 
      s.nome.toLowerCase().includes(busca.toLowerCase())
    );
  }, [servicos, busca]);

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Mão de obra e reparos técnicos"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo serviço
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo serviço</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label>Nome do Serviço</Label>
                  <Input 
                    value={form.nome} 
                    onChange={(e) => setForm({ ...form, nome: e.target.value })} 
                    placeholder="Ex: Troca de Conector"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Custo Estimado</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={form.preco_custo} 
                      onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preço de Venda</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={form.preco_venda} 
                      onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                Salvar serviço
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar serviço..." 
          className="pl-9 max-w-md"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3 text-right">Custo</th>
              <th className="px-4 py-3 text-right">Preço de Venda</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">{s.nome}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{brl(s.preco_custo)}</td>
                <td className="px-4 py-3 text-right font-bold text-primary">{brl(s.preco_venda)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remover.mutate(s.id)}
                    className="text-muted-foreground transition hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!filtrados.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum serviço encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
