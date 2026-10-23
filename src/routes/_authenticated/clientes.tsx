import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Search, Pencil, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useEmpresaId } from "@/hooks/useCurrentUser";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  buscarCep,
  buscarCnpj,
  formatarCep,
  formatarDocumento,
  somenteDigitos,
  validarCnpj,
  validarCpf,
} from "@/lib/documento";
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
  const empresaId = useEmpresaId();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [confirmExcluir, setConfirmExcluir] = useState<{ id: string; nome: string } | null>(null);
  const [cep, setCep] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

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

  function abrirNovo() {
    setEditId(null);
    setForm(vazio);
    setCep("");
    setOpen(true);
  }

  function abrirEdicao(c: (typeof clientes)[number]) {
    setEditId(c.id);
    setForm({
      nome: c.nome ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      documento: c.documento ?? "",
      endereco: c.endereco ?? "",
      observacoes: c.observacoes ?? "",
    });
    setCep("");
    setOpen(true);
  }

  const docDigitos = somenteDigitos(form.documento);
  const docCompleto = docDigitos.length === 11 || docDigitos.length === 14;
  const docValido =
    docDigitos.length === 11
      ? validarCpf(docDigitos)
      : docDigitos.length === 14 && validarCnpj(docDigitos);
  // Só compara com clientes já carregados na tela (a lista inteira da
  // empresa) — o objetivo é evitar cadastro duplicado, não bloquear.
  const clienteDuplicado = docCompleto
    ? clientes.find((c) => c.id !== editId && somenteDigitos(c.documento) === docDigitos)
    : undefined;

  async function preencherPorCnpj(cnpj: string) {
    setBuscandoCnpj(true);
    try {
      const dados = await buscarCnpj(cnpj);
      // Não sobrescreve o que o usuário já digitou.
      setForm((f) => ({
        ...f,
        nome: f.nome.trim() ? f.nome : dados.nome,
        telefone: f.telefone.trim() ? f.telefone : dados.telefone,
        email: f.email.trim() ? f.email : dados.email,
        endereco: f.endereco.trim() ? f.endereco : dados.endereco,
      }));
      if (dados.situacao && dados.situacao !== "ATIVA") {
        toast.warning(`Dados preenchidos. Atenção: CNPJ com situação ${dados.situacao}.`);
      } else {
        toast.success("Dados da empresa preenchidos pelo CNPJ");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuscandoCnpj(false);
    }
  }

  function alterarDocumento(valor: string) {
    const formatado = formatarDocumento(valor);
    setForm((f) => ({ ...f, documento: formatado }));
    const digitos = somenteDigitos(formatado);
    // Dispara uma vez, quando o CNPJ acabou de ficar completo.
    if (
      digitos.length === 14 &&
      somenteDigitos(form.documento).length !== 14 &&
      validarCnpj(digitos)
    ) {
      preencherPorCnpj(digitos);
    }
  }

  async function alterarCep(valor: string) {
    const formatado = formatarCep(valor);
    setCep(formatado);
    const digitos = somenteDigitos(formatado);
    if (digitos.length !== 8 || somenteDigitos(cep).length === 8) return;
    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(digitos);
      setForm((f) => ({ ...f, endereco }));
      toast.success("Endereço preenchido — complete com o número");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuscandoCep(false);
    }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do cliente");
      if (editId) {
        const { error } = await supabase.from("clientes").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert({ ...form, user_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Cliente atualizado" : "Cliente cadastrado");
      setForm(vazio);
      setEditId(null);
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
      setConfirmExcluir(null);
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmExcluir(null);
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
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditId(null);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={abrirNovo}>
                <Plus className="h-4 w-4" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>CPF / CNPJ</Label>
                  <div className="relative">
                    <Input
                      value={form.documento}
                      onChange={(e) => alterarDocumento(e.target.value)}
                      placeholder="Digite o CPF ou CNPJ"
                      inputMode="numeric"
                    />
                    {buscandoCnpj && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {docCompleto && !docValido && (
                    <p className="text-xs text-destructive">
                      {docDigitos.length === 11 ? "CPF inválido" : "CNPJ inválido"}
                    </p>
                  )}
                  {docDigitos.length === 14 && docValido && !buscandoCnpj && (
                    <button
                      type="button"
                      onClick={() => preencherPorCnpj(docDigitos)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Buscar dados do CNPJ novamente
                    </button>
                  )}
                  {clienteDuplicado && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Já existe um cliente com este documento:{" "}
                        <strong>{clienteDuplicado.nome}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => abrirEdicao(clienteDuplicado)}
                        className="ml-auto font-medium text-primary hover:underline"
                      >
                        Abrir cadastro
                      </button>
                    </div>
                  )}
                </div>
                <Campo
                  label="Nome"
                  value={form.nome}
                  onChange={(v) => setForm({ ...form, nome: v })}
                />
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
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <div className="relative">
                    <Input
                      value={cep}
                      onChange={(e) => alterarCep(e.target.value)}
                      placeholder="Preenche o endereço"
                      inputMode="numeric"
                    />
                    {buscandoCep && (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
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
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {editId ? "Salvar alterações" : "Salvar cliente"}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
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
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => abrirEdicao(c)}
                        className="text-muted-foreground transition hover:text-primary"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmExcluir({ id: c.id, nome: c.nome })}
                        className="text-muted-foreground transition hover:text-destructive"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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

      <ConfirmDialog
        open={!!confirmExcluir}
        onOpenChange={(v) => !v && setConfirmExcluir(null)}
        title="Deseja realmente excluir este cliente?"
        description={
          confirmExcluir
            ? `"${confirmExcluir.nome}" será removido permanentemente. Ordens de serviço e vendas já vinculadas continuam existindo, apenas sem o vínculo ao cliente.`
            : ""
        }
        confirmLabel="Excluir"
        destructive
        loading={remover.isPending}
        onConfirm={() => confirmExcluir && remover.mutate(confirmExcluir.id)}
      />
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
