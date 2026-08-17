import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Search, Smartphone, Battery } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { SeminovosFotos } from "@/components/SeminovosFotos";
import { useCurrentUser, useEmpresaId, usePermissoes, podeGerenciar } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/seminovos")({
  head: () => ({
    meta: [
      { title: "Compra de Seminovos — SpaceTech" },
      { name: "description", content: "Avaliação e compra de aparelhos usados." },
    ],
  }),
  component: Seminovos,
});

const STATUS_SEMINOVOS = [
  { value: "em_avaliacao", label: "Em avaliação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "recusado", label: "Recusado" },
  { value: "comprado", label: "Comprado" },
  { value: "vendido", label: "Vendido" },
];

const ESTADOS = ["Excelente", "Bom", "Regular", "Ruim"];

const vazio = {
  cliente_id: "",
  vendedor_nome: "",
  vendedor_telefone: "",
  marca: "",
  modelo: "",
  imei: "",
  armazenamento: "",
  ram: "",
  cor: "",
  estado: "Bom",
  bateria_percentual: "",
  acessorios: "",
  observacoes: "",
  valor_oferecido: "0",
  valor_pago: "",
  status: "em_avaliacao",
};

function Seminovos() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const { data: permissoes } = usePermissoes();
  const gerenciar = podeGerenciar(permissoes, "seminovos");

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);

  const { data: itens = [] } = useQuery({
    queryKey: ["seminovos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seminovos")
        .select("*, cliente:clientes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-seminovos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm(vazio);
    setEditId(null);
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Usuário não autenticado");
      if (!form.marca.trim() || !form.modelo.trim()) throw new Error("Informe marca e modelo");

      const payload = {
        user_id: empresaId!,
        cliente_id: form.cliente_id || null,
        vendedor_nome: form.vendedor_nome || null,
        vendedor_telefone: form.vendedor_telefone || null,
        marca: form.marca,
        modelo: form.modelo,
        imei: form.imei || null,
        armazenamento: form.armazenamento || null,
        ram: form.ram || null,
        cor: form.cor || null,
        estado: form.estado || null,
        bateria_percentual: form.bateria_percentual ? Number(form.bateria_percentual) : null,
        acessorios: form.acessorios || null,
        observacoes: form.observacoes || null,
        valor_oferecido: form.valor_oferecido ? Number(form.valor_oferecido) : null,
        valor_pago: form.valor_pago ? Number(form.valor_pago) : null,
        status: form.status,
      };

      if (editId) {
        const { error } = await supabase.from("seminovos").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("seminovos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Avaliação atualizada" : "Avaliação registrada");
      resetForm();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["seminovos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("seminovos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seminovos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seminovos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro removido");
      qc.invalidateQueries({ queryKey: ["seminovos"] });
    },
  });

  function abrirEdicao(s: any) {
    setEditId(s.id);
    setForm({
      cliente_id: s.cliente_id ?? "",
      vendedor_nome: s.vendedor_nome ?? "",
      vendedor_telefone: s.vendedor_telefone ?? "",
      marca: s.marca,
      modelo: s.modelo,
      imei: s.imei ?? "",
      armazenamento: s.armazenamento ?? "",
      ram: s.ram ?? "",
      cor: s.cor ?? "",
      estado: s.estado ?? "Bom",
      bateria_percentual: s.bateria_percentual != null ? String(s.bateria_percentual) : "",
      acessorios: s.acessorios ?? "",
      observacoes: s.observacoes ?? "",
      valor_oferecido: s.valor_oferecido != null ? String(s.valor_oferecido) : "0",
      valor_pago: s.valor_pago != null ? String(s.valor_pago) : "",
      status: s.status,
    });
    setOpen(true);
  }

  const filtrados = itens.filter((s) => {
    const bateStatus = filtro === "todos" || s.status === filtro;
    const bateBusca = `${s.marca} ${s.modelo} ${s.imei ?? ""}`
      .toLowerCase()
      .includes(busca.toLowerCase());
    return bateStatus && bateBusca;
  });

  const corStatus: Record<string, string> = {
    em_avaliacao: "bg-amber-500/10 text-amber-500",
    aprovado: "bg-primary/10 text-primary",
    recusado: "bg-destructive/10 text-destructive",
    comprado: "bg-emerald-500/10 text-emerald-500",
    vendido: "bg-secondary text-foreground",
  };

  return (
    <div>
      <PageHeader
        title="Compra de Seminovos"
        subtitle="Avaliação e compra de aparelhos usados"
        action={
          gerenciar && (
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" /> Nova avaliação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editId ? "Editar avaliação" : "Nova avaliação"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Cliente cadastrado (opcional)</Label>
                    <Select
                      value={form.cliente_id || "none"}
                      onValueChange={(v) => setForm({ ...form, cliente_id: v === "none" ? "" : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Campo
                    label="Ou nome do vendedor"
                    value={form.vendedor_nome}
                    onChange={(v) => setForm({ ...form, vendedor_nome: v })}
                  />
                  <Campo
                    label="Telefone do vendedor"
                    value={form.vendedor_telefone}
                    onChange={(v) => setForm({ ...form, vendedor_telefone: v })}
                  />
                  <Campo
                    label="Marca"
                    value={form.marca}
                    onChange={(v) => setForm({ ...form, marca: v })}
                  />
                  <Campo
                    label="Modelo"
                    value={form.modelo}
                    onChange={(v) => setForm({ ...form, modelo: v })}
                  />
                  <Campo
                    label="IMEI"
                    value={form.imei}
                    onChange={(v) => setForm({ ...form, imei: v })}
                  />
                  <Campo
                    label="Armazenamento"
                    value={form.armazenamento}
                    onChange={(v) => setForm({ ...form, armazenamento: v })}
                  />
                  <Campo
                    label="RAM"
                    value={form.ram}
                    onChange={(v) => setForm({ ...form, ram: v })}
                  />
                  <Campo
                    label="Cor"
                    value={form.cor}
                    onChange={(v) => setForm({ ...form, cor: v })}
                  />
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <Select
                      value={form.estado}
                      onValueChange={(v) => setForm({ ...form, estado: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS.map((e) => (
                          <SelectItem key={e} value={e}>
                            {e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Campo
                    label="Bateria (%)"
                    value={form.bateria_percentual}
                    onChange={(v) => setForm({ ...form, bateria_percentual: v })}
                  />
                  <div className="sm:col-span-2">
                    <Campo
                      label="Acessórios"
                      value={form.acessorios}
                      onChange={(v) => setForm({ ...form, acessorios: v })}
                    />
                  </div>
                  <Campo
                    label="Valor oferecido (R$)"
                    value={form.valor_oferecido}
                    onChange={(v) => setForm({ ...form, valor_oferecido: v })}
                  />
                  <Campo
                    label="Valor pago (R$)"
                    value={form.valor_pago}
                    onChange={(v) => setForm({ ...form, valor_pago: v })}
                  />
                  {editId && (
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_SEMINOVOS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label>Observações</Label>
                    <Textarea
                      value={form.observacoes}
                      onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  {editId ? "Salvar alterações" : "Registrar avaliação"}
                </Button>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[{ value: "todos", label: "Todos" }, ...STATUS_SEMINOVOS].map((s) => (
          <button
            key={s.value}
            onClick={() => setFiltro(s.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filtro === s.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por marca, modelo ou IMEI..."
          className="pl-9"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((s) => (
          <div
            key={s.id}
            className="group relative rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/50"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Smartphone className="h-5 w-5" />
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${corStatus[s.status]}`}
              >
                {STATUS_SEMINOVOS.find((st) => st.value === s.status)?.label}
              </span>
            </div>

            <div className="mt-4 cursor-pointer" onClick={() => gerenciar && abrirEdicao(s)}>
              <h3 className="text-lg font-bold leading-tight">
                {s.marca} {s.modelo}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                IMEI: {s.imei || "Não informado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {[s.armazenamento, s.ram, s.cor, s.estado].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vendedor:</span>
                <span className="font-medium">
                  {s.cliente?.nome || s.vendedor_nome || "Particular"}
                </span>
              </div>
              {s.bateria_percentual != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Battery className="h-3.5 w-3.5" /> Bateria:
                  </span>
                  <span className="font-medium">{s.bateria_percentual}%</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Oferecido:</span>
                <span className="font-semibold">{brl(s.valor_oferecido)}</span>
              </div>
              {s.valor_pago != null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pago:</span>
                  <span className="font-bold text-primary">{brl(s.valor_pago)}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
              <span className="text-[10px] text-muted-foreground">{dataBR(s.data_avaliacao)}</span>
              <div className="flex items-center gap-2">
                <SeminovosFotos seminovoId={s.id} fotos={s.fotos ?? []} empresaId={s.user_id} />
                {gerenciar && (
                  <button
                    onClick={() => remover.mutate(s.id)}
                    className="text-muted-foreground transition hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {gerenciar && s.status === "em_avaliacao" && (
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => mudarStatus.mutate({ id: s.id, status: "aprovado" })}
                >
                  Aprovar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => mudarStatus.mutate({ id: s.id, status: "recusado" })}
                >
                  Recusar
                </Button>
              </div>
            )}
          </div>
        ))}
        {!filtrados.length && (
          <div className="col-span-full rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Nenhuma avaliação registrada</h3>
          </div>
        )}
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
