import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — SpaceTech" },
      { name: "description", content: "Cadastro de clientes da sua assistência técnica." },
      { property: "og:title", content: "Clientes — SpaceTech" },
      { property: "og:description", content: "Gerencie os clientes da sua assistência." },
    ],
  }),
  component: Clientes,
});

const vazio = { nome: "", telefone: "", email: "", documento: "", endereco: "", observacoes: "" };

function Clientes() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do cliente");
      const { error } = await supabase.from("clientes").insert({ ...form, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
  });

  const filtrados = clientes.filter((c) =>
    `${c.nome} ${c.telefone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(busca.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Todo o histórico da sua assistência começa aqui"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cliente</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
                <Campo
                  label="Telefone"
                  value={form.telefone}
                  onChange={(v) => setForm({ ...form, telefone: v })}
                />
                <Campo
                  label="Email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                <Campo
                  label="CPF / CNPJ"
                  value={form.documento}
                  onChange={(v) => setForm({ ...form, documento: v })}
                />
                <div className="sm:col-span-2">
                  <Campo
                    label="Endereço"
                    value={form.endereco}
                    onChange={(v) => setForm({ ...form, endereco: v })}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
                Salvar cliente
              </Button>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="hidden px-4 py-3 sm:table-cell">Email</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.nome}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.telefone || "—"}</td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {c.email || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remover.mutate(c.id)}
                    className="text-muted-foreground transition hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!filtrados.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
