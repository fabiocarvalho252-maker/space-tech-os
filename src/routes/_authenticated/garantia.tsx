import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Eye, Pencil, Plus, Power, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { dataBR } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, TableSkeleton } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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

type Termo = {
  id: string;
  titulo: string;
  conteudo: string;
  is_default: boolean | null;
  ativo: boolean;
  created_at: string | null;
};

function Garantia() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ titulo: "", conteudo: "" });
  const [verTermo, setVerTermo] = useState<Termo | null>(null);
  const [confirmDesativar, setConfirmDesativar] = useState<Termo | null>(null);

  const { data: termos = [], isLoading } = useQuery({
    queryKey: ["termos_garantia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termos_garantia")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Termo[];
    },
    enabled: !!user,
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (!form.titulo.trim()) throw new Error("Informe o título do termo");
      if (editId) {
        const { error } = await supabase.from("termos_garantia").update(form).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("termos_garantia")
          .insert([{ ...form, user_id: user.id, is_default: termos.length === 0 }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termos_garantia"] });
      toast.success(editId ? "Termo atualizado!" : "Novo termo criado!");
      setOpen(false);
      resetForm();
    },
    onError: (err: Error) => toast.error("Erro ao salvar termo: " + err.message),
  });

  const alternarAtivo = useMutation({
    mutationFn: async (termo: Termo) => {
      const { error } = await supabase
        .from("termos_garantia")
        .update({ ativo: !termo.ativo })
        .eq("id", termo.id);
      if (error) throw error;
      return !termo.ativo;
    },
    onSuccess: (novoAtivo) => {
      qc.invalidateQueries({ queryKey: ["termos_garantia"] });
      toast.success(novoAtivo ? "Termo reativado." : "Termo desativado.");
      setConfirmDesativar(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tornarPadrao = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("termos_garantia")
        .update({ is_default: false })
        .eq("user_id", user?.id || "");
      const { error } = await supabase
        .from("termos_garantia")
        .update({ is_default: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["termos_garantia"] });
      toast.success("Termo definido como padrão!");
    },
  });

  function resetForm() {
    setForm({ titulo: "", conteudo: "" });
    setEditId(null);
  }

  function handleEdit(termo: Termo) {
    setEditId(termo.id);
    setForm({ titulo: termo.titulo, conteudo: termo.conteudo });
    setOpen(true);
  }

  function imprimir(termo: Termo) {
    const janela = window.open("", "_blank", "width=700,height=800");
    if (!janela) return;
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>${termo.titulo}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#1b1b2b;line-height:1.6}
      h1{font-size:18px;border-bottom:2px solid #4f46e5;padding-bottom:10px}
      p{white-space:pre-line;font-size:13px}</style></head><body>
      <h1>${termo.titulo}</h1><p>${termo.conteudo}</p>
      <script>window.onload=()=>window.print()<\/script></body></html>`);
    janela.document.close();
  }

  return (
    <div>
      <PageHeader
        title="Termos de Garantia"
        subtitle="Configure as cláusulas de garantia que aparecerão nos seus comprovantes de OS."
        action={
          <Dialog
            open={open}
            onOpenChange={(val) => {
              setOpen(val);
              if (!val) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-600/90">
                <Plus className="h-4 w-4" /> Termo Garantia
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
                    onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conteúdo das Cláusulas</Label>
                  <Textarea
                    placeholder="Descreva aqui os termos da garantia..."
                    className="min-h-[200px] resize-none"
                    value={form.conteudo}
                    onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : "Salvar Termo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Termo de Garantia</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-4">
                  <TableSkeleton />
                </td>
              </tr>
            ) : !termos.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-4">
                  <EmptyState
                    icon={ShieldCheck}
                    title="Sem termos de garantia"
                    description="Crie termos de garantia personalizados para aparecerem automaticamente nos seus comprovantes."
                  />
                </td>
              </tr>
            ) : (
              termos.map((termo, i) => (
                <tr key={termo.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 text-muted-foreground">{dataBR(termo.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{termo.titulo}</span>
                      {termo.is_default && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          <CheckCircle2 className="h-3 w-3" /> Padrão
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={termo.ativo ? "Ativo" : "Inativo"}
                      tone={termo.ativo ? "success" : "neutral"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconAction label="Visualizar" onClick={() => setVerTermo(termo)}>
                        <Eye className="h-4 w-4" />
                      </IconAction>
                      <IconAction label="Imprimir" onClick={() => imprimir(termo)}>
                        <Printer className="h-4 w-4" />
                      </IconAction>
                      <IconAction label="Editar" onClick={() => handleEdit(termo)}>
                        <Pencil className="h-4 w-4" />
                      </IconAction>
                      {!termo.is_default && termo.ativo && (
                        <button
                          onClick={() => tornarPadrao.mutate(termo.id)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          Tornar padrão
                        </button>
                      )}
                      <IconAction
                        label={termo.ativo ? "Desativar" : "Reativar"}
                        destructive={termo.ativo}
                        onClick={() => setConfirmDesativar(termo)}
                      >
                        <Power className="h-4 w-4" />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-2xl bg-primary/5 p-6 border border-primary/10">
        <div className="flex items-start gap-4">
          <ShieldCheck className="mt-1 h-6 w-6 text-primary shrink-0" />
          <div>
            <h4 className="font-bold text-primary">Como funciona?</h4>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              O termo definido como <strong>Padrão</strong> será impresso automaticamente em todas
              as suas Ordens de Serviço. Você pode criar diferentes termos (ex: Garantia de Tela,
              Garantia de Software) e trocá-los conforme a necessidade. Desativar um termo só o
              remove das novas impressões — o histórico é mantido.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={!!verTermo} onOpenChange={(v) => !v && setVerTermo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{verTermo?.titulo}</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{verTermo?.conteudo}</p>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDesativar}
        onOpenChange={(v) => !v && setConfirmDesativar(null)}
        title={
          confirmDesativar?.ativo
            ? "Deseja realmente desativar este termo?"
            : "Deseja reativar este termo?"
        }
        description={
          confirmDesativar
            ? confirmDesativar.ativo
              ? `"${confirmDesativar.titulo}" deixará de aparecer para novas OS, mas o histórico é preservado.`
              : `"${confirmDesativar.titulo}" voltará a ficar disponível.`
            : ""
        }
        confirmLabel={confirmDesativar?.ativo ? "Desativar" : "Reativar"}
        destructive={!!confirmDesativar?.ativo}
        loading={alternarAtivo.isPending}
        onConfirm={() => confirmDesativar && alternarAtivo.mutate(confirmDesativar)}
      />
    </div>
  );
}

function IconAction({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary ${
        destructive ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
