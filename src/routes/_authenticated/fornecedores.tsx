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

export const Route = createFileRoute("/_authenticated/fornecedores")({
  head: () => ({
    meta: [
      { title: "Fornecedores — SpaceTech" },
      { name: "description", content: "Cadastro de fornecedores da sua assistência técnica." },
      { property: "og:title", content: "Fornecedores — SpaceTech" },
      { property: "og:description", content: "Gerencie os fornecedores da sua assistência." },
    ],
  }),
  component: Fornecedores,
});

const vazio = {
  razao_social: "",
  nome_fantasia: "",
  cnpj_cpf: "",
  telefone: "",
  whatsapp: "",
  email: "",
  endereco: "",
  observacoes: "",
};

function Fornecedores() {
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!form.razao_social.trim()) throw new Error("Informe a razão social do fornecedor");
      const { error } = await supabase.from("fornecedores").insert({ ...form, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor cadastrado");
      setForm(vazio);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor removido");
      qc.invalidateQueries({ queryKey: ["fornecedores"] });
    },
  });

  const filtrados = fornecedores.filter((f) =>
    `${f.razao_social} ${f.nome_fantasia ?? ""} ${f.telefone ?? ""} ${f.email ?? ""}`
      .toLowerCase()
      .includes(busca.toLowerCase()),
  );

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Quem abastece o estoque e as peças da sua assistência"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Novo fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo fornecedor</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  label="Razão social"
                  value={form.razao_social}
                  onChange={(v) => setForm({ ...form, razao_social: v })}
                />
                <Campo
                  label="Nome fantasia"
                  value={form.nome_fantasia}
                  onChange={(v) => setForm({ ...form, nome_fantasia: v })}
                />
                <Campo
                  label="CNPJ / CPF"
                  value={form.cnpj_cpf}
                  onChange={(v) => setForm({ ...form, cnpj_cpf: v })}
                />
                <Campo
                  label="Telefone"
                  value={form.telefone}
                  onChange={(v) => setForm({ ...form, telefone: v })}
                />
                <Campo
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChange={(v) => setForm({ ...form, whatsapp: v })}
                />
                <Campo
                  label="Email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
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
                Salvar fornecedor
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
          placeholder="Buscar fornecedor..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Razão social</th>
                <th className="hidden px-4 py-3 sm:table-cell">Nome fantasia</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="hidden px-4 py-3 md:table-cell">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-3 font-medium">{f.razao_social}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {f.nome_fantasia || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{f.telefone || "—"}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {f.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remover.mutate(f.id)}
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
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
