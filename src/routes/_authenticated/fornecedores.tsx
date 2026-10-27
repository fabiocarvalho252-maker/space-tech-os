import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  AlertTriangle,
  Pencil,
  PackageSearch,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
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
import { ConsultarPecasDialog } from "@/components/fornecedores/ConsultarPecasDialog";
import { HistoricoConsultasDialog } from "@/components/fornecedores/HistoricoConsultasDialog";
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
  const empresaId = useEmpresaId();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [cep, setCep] = useState("");
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [consultarOpen, setConsultarOpen] = useState(false);
  const [historicoOpen, setHistoricoOpen] = useState(false);

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

  function abrirNovo() {
    setEditId(null);
    setForm(vazio);
    setCep("");
    setOpen(true);
  }

  function abrirEdicao(f: (typeof fornecedores)[number]) {
    setEditId(f.id);
    setForm({
      razao_social: f.razao_social ?? "",
      nome_fantasia: f.nome_fantasia ?? "",
      cnpj_cpf: f.cnpj_cpf ?? "",
      telefone: f.telefone ?? "",
      whatsapp: f.whatsapp ?? "",
      email: f.email ?? "",
      endereco: f.endereco ?? "",
      observacoes: f.observacoes ?? "",
    });
    setCep("");
    setOpen(true);
  }

  const docDigitos = somenteDigitos(form.cnpj_cpf);
  const docCompleto = docDigitos.length === 11 || docDigitos.length === 14;
  const docValido =
    docDigitos.length === 11
      ? validarCpf(docDigitos)
      : docDigitos.length === 14 && validarCnpj(docDigitos);
  const fornecedorDuplicado = docCompleto
    ? fornecedores.find((f) => f.id !== editId && somenteDigitos(f.cnpj_cpf) === docDigitos)
    : undefined;

  async function preencherPorCnpj(cnpj: string) {
    setBuscandoCnpj(true);
    try {
      const dados = await buscarCnpj(cnpj);
      // Não sobrescreve o que o usuário já digitou.
      setForm((f) => ({
        ...f,
        razao_social: f.razao_social.trim() ? f.razao_social : dados.razaoSocial,
        nome_fantasia: f.nome_fantasia.trim() ? f.nome_fantasia : dados.nomeFantasia,
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
    setForm((f) => ({ ...f, cnpj_cpf: formatado }));
    const digitos = somenteDigitos(formatado);
    // Dispara uma vez, quando o CNPJ acabou de ficar completo.
    if (
      digitos.length === 14 &&
      somenteDigitos(form.cnpj_cpf).length !== 14 &&
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
      if (!form.razao_social.trim()) throw new Error("Informe a razão social do fornecedor");
      if (editId) {
        const { error } = await supabase.from("fornecedores").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fornecedores")
          .insert({ ...form, user_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Fornecedor atualizado" : "Fornecedor cadastrado");
      setForm(vazio);
      setEditId(null);
      setCep("");
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
          <>
            <Button variant="outline" onClick={() => setHistoricoOpen(true)}>
              <History className="h-4 w-4" /> Histórico
            </Button>
            <Button variant="outline" onClick={() => setConsultarOpen(true)}>
              <PackageSearch className="h-4 w-4" /> Consultar peças
            </Button>
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) setEditId(null);
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={abrirNovo}>
                  <Plus className="h-4 w-4" /> Novo fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editId ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>CNPJ / CPF</Label>
                    <div className="relative">
                      <Input
                        value={form.cnpj_cpf}
                        onChange={(e) => alterarDocumento(e.target.value)}
                        placeholder="Digite o CNPJ ou CPF"
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
                    {fornecedorDuplicado && (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                        <span>
                          Já existe um fornecedor com este documento:{" "}
                          <strong>{fornecedorDuplicado.razao_social}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => abrirEdicao(fornecedorDuplicado)}
                          className="ml-auto font-medium text-primary hover:underline"
                        >
                          Abrir cadastro
                        </button>
                      </div>
                    )}
                  </div>
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
                  {editId ? "Salvar alterações" : "Salvar fornecedor"}
                </Button>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <ConsultarPecasDialog
        open={consultarOpen}
        onOpenChange={setConsultarOpen}
        fornecedores={fornecedores}
        onEditarFornecedor={(id) => {
          const f = fornecedores.find((x) => x.id === id);
          if (f) abrirEdicao(f);
        }}
      />
      <HistoricoConsultasDialog open={historicoOpen} onOpenChange={setHistoricoOpen} />

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
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => abrirEdicao(f)}
                        className="text-muted-foreground transition hover:text-primary"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remover.mutate(f.id)}
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
