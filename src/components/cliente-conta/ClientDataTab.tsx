import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { atualizarMeusDados } from "@/lib/cliente-conta/cliente-conta.functions";
import type { MeuCliente } from "./types";

export function ClientDataTab({ cliente }: { cliente: MeuCliente }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nome: cliente.nome,
    telefone: cliente.telefone ?? "",
    documento: cliente.documento ?? "",
    email: cliente.email ?? "",
    endereco: cliente.endereco ?? "",
  });

  const salvar = useMutation({
    mutationFn: () =>
      atualizarMeusDados({
        data: {
          nome: form.nome,
          telefone: form.telefone || null,
          documento: form.documento || null,
          email: form.email || null,
          endereco: form.endereco || null,
        },
      }),
    onSuccess: () => {
      toast.success("Dados atualizados!");
      qc.invalidateQueries({ queryKey: ["minha-conta-cliente"] });
      setEditando(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
            <User className="h-4 w-4" />
          </span>
          <h3 className="font-bold text-slate-900">Informações pessoais</h3>
        </div>
        {!editando && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditando(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </div>

      {editando ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
          <Campo
            label="CPF/CNPJ"
            value={form.documento}
            onChange={(v) => setForm({ ...form, documento: v })}
          />
          <Campo
            label="Email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <Campo
            label="Celular/WhatsApp"
            value={form.telefone}
            onChange={(v) => setForm({ ...form, telefone: v })}
          />
          <Campo
            label="Endereço"
            value={form.endereco}
            onChange={(v) => setForm({ ...form, endereco: v })}
            full
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
              {salvar.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button variant="outline" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Info label="Nome" valor={cliente.nome} />
          <Info label="CPF/CNPJ" valor={cliente.documento} />
          <Info label="Email" valor={cliente.email} />
          <Info label="Celular/WhatsApp" valor={cliente.telefone} />
          <Info label="Endereço" valor={cliente.endereco} full />
        </div>
      )}
    </section>
  );
}

function Info({ label, valor, full }: { label: string; valor: string | null; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-slate-800">{valor || "Não informado"}</p>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <div className={full ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
