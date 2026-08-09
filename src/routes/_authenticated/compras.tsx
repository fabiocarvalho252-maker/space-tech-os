import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Search, Smartphone, AlertCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras de Aparelhos — SpaceTech" },
      { name: "description", content: "Gerencie compras de aparelhos seminovos ou com defeitos." },
    ],
  }),
  component: ComprasAparelhos,
});

const vazio = { 
  cliente_id: "", 
  modelo: "", 
  marca: "", 
  imei_serial: "", 
  tipo: "seminovo" as "seminovo" | "com_defeito", 
  condicao_detalhada: "", 
  valor_pago: "0" 
};

function ComprasAparelhos() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras_aparelhos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras_aparelhos")
        .select(`
          *,
          cliente:clientes(nome)
        `)
        .order("data_compra", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.modelo.trim()) throw new Error("Informe o modelo do aparelho");
      const { error } = await supabase.from("compras_aparelhos").insert({
        ...form,
        valor_pago: parseFloat(form.valor_pago),
        user_id: user!.id,
        cliente_id: form.cliente_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Compra registrada com sucesso!");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["compras_aparelhos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("compras_aparelhos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["compras_aparelhos"] });
    },
  });

  const filtrados = compras.filter((c) =>
    `${c.modelo} ${c.marca ?? ""} ${c.imei_serial ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Compra de Aparelhos"
        subtitle="Gerencie aquisições de seminovos e aparelhos com defeito para revenda ou peças."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Registrar Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Compra de Aparelho</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipo de Compra</Label>
                  <Select 
                    value={form.tipo} 
                    onValueChange={(v: any) => setForm({...form, tipo: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seminovo">Seminovo (Revenda)</SelectItem>
                      <SelectItem value="com_defeito">Com Defeito (Sucata/Reparo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Cliente (Vendedor)</Label>
                  <Select 
                    value={form.cliente_id} 
                    onValueChange={(v) => setForm({...form, cliente_id: v})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Marca</Label>
                  <Input 
                    placeholder="Ex: Apple, Samsung" 
                    value={form.marca}
                    onChange={(e) => setForm({...form, marca: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Modelo</Label>
                  <Input 
                    placeholder="Ex: iPhone 13, Galaxy S21" 
                    value={form.modelo}
                    onChange={(e) => setForm({...form, modelo: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>IMEI / Serial</Label>
                  <Input 
                    placeholder="Número de identificação" 
                    value={form.imei_serial}
                    onChange={(e) => setForm({...form, imei_serial: e.target.value})}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Valor Pago</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="0,00" 
                    value={form.valor_pago}
                    onChange={(e) => setForm({...form, valor_pago: e.target.value})}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Condição e Observações</Label>
                  <Textarea 
                    placeholder="Descreva o estado do aparelho, defeitos constatados, etc."
                    value={form.condicao_detalhada}
                    onChange={(e) => setForm({...form, condicao_detalhada: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                  {criar.isPending ? "Salvando..." : "Registrar Compra"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por modelo ou IMEI..."
          className="pl-9"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando compras...</p>
        ) : filtrados.length > 0 ? (
          filtrados.map((compra) => (
            <div 
              key={compra.id} 
              className="group relative rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {compra.tipo === 'seminovo' ? <Smartphone className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  compra.tipo === 'seminovo' ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {compra.tipo === 'seminovo' ? 'Seminovo' : 'Com Defeito'}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-bold text-lg leading-tight">{compra.marca} {compra.modelo}</h3>
                <p className="text-xs text-muted-foreground mt-1">IMEI: {compra.imei_serial || 'Não informado'}</p>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Vendedor:</span>
                  <span className="font-medium">{(compra.cliente as any)?.nome || 'Particular'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Valor Pago:</span>
                  <span className="font-bold text-primary">{brl(compra.valor_pago)}</span>
                </div>
              </div>

              {compra.condicao_detalhada && (
                <p className="mt-4 line-clamp-2 text-xs text-muted-foreground italic">
                  "{compra.condicao_detalhada}"
                </p>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(compra.data_compra).toLocaleDateString('pt-BR')}
                </span>
                <button
                  onClick={() => {
                    if(confirm("Deseja excluir este registro de compra?")) remover.mutate(compra.id);
                  }}
                  className="text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Nenhuma compra registrada</h3>
            <p className="mx-auto max-w-xs text-sm mt-1">
              Comece a registrar as aquisições de aparelhos seminovos ou para retirada de peças.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
