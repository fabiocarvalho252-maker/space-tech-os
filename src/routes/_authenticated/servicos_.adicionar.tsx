import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import { SectionCard } from "@/components/SectionCard";

export const Route = createFileRoute("/_authenticated/servicos_/adicionar")({
  head: () => ({
    meta: [{ title: "Cadastro de serviço — SpaceTech" }],
  }),
  // ?id=<produto.id> reuses this same page to edit an existing serviço
  // instead of a second route — same deep-link convention used elsewhere
  // (Faturar OS, Ordens em aberto).
  validateSearch: (search: Record<string, unknown>): { id?: string } => {
    const id = search["id"];
    return typeof id === "string" ? { id } : {};
  },
  component: CadastroServico,
});

const vazio = {
  nome: "",
  preco_venda: "0",
  preco_custo: "0",
  comissao_percentual: "0",
  descricao: "",
};

function CadastroServico() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const [form, setForm] = useState(vazio);
  const [carregado, setCarregado] = useState(!id);

  const { data: servicoAtual } = useQuery({
    queryKey: ["servico-editar", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("id", id as string)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!servicoAtual || carregado) return;
    setForm({
      nome: servicoAtual.nome,
      preco_venda: String(servicoAtual.preco_venda),
      preco_custo: String(servicoAtual.preco_custo),
      comissao_percentual: String(servicoAtual.comissao_percentual ?? 0),
      descricao: servicoAtual.descricao ?? "",
    });
    setCarregado(true);
  }, [servicoAtual, carregado]);

  const precoVenda = Number(form.preco_venda) || 0;
  const custoAdicional = Number(form.preco_custo) || 0;
  const comissaoPercentual = Math.min(100, Math.max(0, Number(form.comissao_percentual) || 0));
  const comissaoValor = (precoVenda * comissaoPercentual) / 100;
  const lucroEstimado = precoVenda - custoAdicional - comissaoValor;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do serviço");
      if (precoVenda <= 0) throw new Error("O preço cobrado do cliente deve ser maior que zero");
      if (comissaoPercentual < 0 || comissaoPercentual > 100) {
        throw new Error("A comissão deve estar entre 0 e 100%");
      }

      const payload = {
        nome: form.nome,
        preco_venda: precoVenda,
        preco_custo: custoAdicional,
        comissao_percentual: comissaoPercentual,
        descricao: form.descricao || null,
        categoria: "Serviço",
      };

      if (id) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("produtos")
          .insert({ ...payload, user_id: user!.id, quantidade: 999, estoque_minimo: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(id ? "Serviço atualizado" : "Serviço cadastrado");
      qc.invalidateQueries({ queryKey: ["servicos"] });
      navigate({ to: "/servicos" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <Wrench className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Cadastro de serviço</h1>
        </div>
        <p className="mt-3 max-w-xl text-sm text-white/85">
          Informe o nome e o preço cobrado do cliente. Se o serviço tiver um gasto seu (material ou
          terceiros), preencha o custo adicional para o lucro sair certo no DRE.
        </p>
      </div>

      <SectionCard title="Dados do serviço">
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Troca de conector de carga"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Preço cobrado do cliente</Label>
              <MoneyInput
                value={form.preco_venda}
                onChange={(v) => setForm({ ...form, preco_venda: String(v) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Custo adicional</Label>
              <MoneyInput
                value={form.preco_custo}
                onChange={(v) => setForm({ ...form, preco_custo: String(v) })}
              />
              <p className="text-xs text-muted-foreground">
                Custos diretamente relacionados à execução do serviço.
              </p>
            </div>
          </div>
          <div className="space-y-1.5 sm:w-56">
            <Label>Comissão deste serviço (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.comissao_percentual}
              onChange={(e) => setForm({ ...form, comissao_percentual: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              rows={5}
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Detalhes visíveis internamente sobre este serviço..."
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="DRE do serviço" icon={Sparkles}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metrica label="Preço de venda" valor={brl(precoVenda)} />
          <Metrica label="Custo adicional" valor={brl(custoAdicional)} />
          <Metrica label={`Comissão (${comissaoPercentual}%)`} valor={brl(comissaoValor)} />
          <Metrica
            label="Lucro estimado"
            valor={brl(lucroEstimado)}
            destaque={lucroEstimado >= 0 ? "text-emerald-600" : "text-destructive"}
          />
        </div>
      </SectionCard>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          className="border-orange-300 text-orange-600 hover:bg-orange-50"
          onClick={() => navigate({ to: "/servicos" })}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button
          className="bg-blue-600 hover:bg-blue-600/90"
          disabled={salvar.isPending}
          onClick={() => salvar.mutate()}
        >
          {salvar.isPending ? "Adicionando..." : id ? "Salvar alterações" : "+ Adicionar"}
        </Button>
      </div>
    </div>
  );
}

function Metrica({ label, valor, destaque }: { label: string; valor: string; destaque?: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-bold ${destaque ?? ""}`}>{valor}</p>
    </div>
  );
}
