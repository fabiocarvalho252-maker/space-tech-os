import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  preco_custo: "0",
  mao_de_obra: "0",
  comissao_percentual: "0",
  descricao: "",
  fornecedor_id: "",
  tempo_estimado_min: "",
  garantia_dias: "",
  ativo: true,
};

/** "" → null; senão inteiro >= 0. */
function inteiroOuNulo(v: string): number | null {
  if (!v.trim()) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function CadastroServico() {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const [form, setForm] = useState(vazio);
  const [carregado, setCarregado] = useState(!id);

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores-opcoes"],
    queryFn: async () =>
      (
        await supabase
          .from("fornecedores")
          .select("id, razao_social, nome_fantasia")
          .order("razao_social")
      ).data ?? [],
  });

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
      preco_custo: String(servicoAtual.preco_custo),
      // Mão de obra = o que se cobra além da peça.
      mao_de_obra: String(
        Math.max(0, Number(servicoAtual.preco_venda) - Number(servicoAtual.preco_custo)),
      ),
      comissao_percentual: String(servicoAtual.comissao_percentual ?? 0),
      descricao: servicoAtual.descricao ?? "",
      fornecedor_id: servicoAtual.fornecedor_id ?? "",
      tempo_estimado_min:
        servicoAtual.tempo_estimado_min != null ? String(servicoAtual.tempo_estimado_min) : "",
      garantia_dias: servicoAtual.garantia_dias != null ? String(servicoAtual.garantia_dias) : "",
      ativo: servicoAtual.ativo,
    });
    setCarregado(true);
  }, [servicoAtual, carregado]);

  // Preço do serviço = custo da peça + mão de obra.
  const custoAdicional = Number(form.preco_custo) || 0;
  const maoDeObra = Number(form.mao_de_obra) || 0;
  const precoVenda = custoAdicional + maoDeObra;
  const comissaoPercentual = Math.min(100, Math.max(0, Number(form.comissao_percentual) || 0));
  const comissaoValor = (precoVenda * comissaoPercentual) / 100;
  const lucroEstimado = precoVenda - custoAdicional - comissaoValor;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Informe o nome do serviço");
      if (precoVenda <= 0) throw new Error("Informe o valor da peça e/ou da mão de obra");
      if (comissaoPercentual < 0 || comissaoPercentual > 100) {
        throw new Error("A comissão deve estar entre 0 e 100%");
      }

      const payload = {
        nome: form.nome,
        preco_venda: precoVenda,
        preco_custo: custoAdicional,
        comissao_percentual: comissaoPercentual,
        descricao: form.descricao || null,
        fornecedor_id: form.fornecedor_id || null,
        categoria: "Serviço",
        tempo_estimado_min: inteiroOuNulo(form.tempo_estimado_min),
        garantia_dias: inteiroOuNulo(form.garantia_dias),
        ativo: form.ativo,
      };

      if (id) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("produtos")
          .insert({ ...payload, user_id: empresaId!, quantidade: 999, estoque_minimo: 0 });
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
          O serviço é a peça com a mão de obra: informe quanto a peça custa para você e quanto cobra
          de mão de obra — o preço para o cliente é a soma dos dois.
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
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div className="space-y-1.5">
              <Label>Peça (seu custo)</Label>
              <MoneyInput
                value={form.preco_custo}
                onChange={(v) => setForm({ ...form, preco_custo: String(v) })}
              />
              <p className="text-xs text-muted-foreground">
                Quanto você paga na peça. Sem peça, deixe 0.
              </p>
            </div>
            <span className="hidden pt-8 text-lg font-bold text-muted-foreground sm:block">+</span>
            <div className="space-y-1.5">
              <Label>Mão de obra</Label>
              <MoneyInput
                value={form.mao_de_obra}
                onChange={(v) => setForm({ ...form, mao_de_obra: String(v) })}
              />
              <p className="text-xs text-muted-foreground">O valor do seu trabalho.</p>
            </div>
            <span className="hidden pt-8 text-lg font-bold text-muted-foreground sm:block">=</span>
            <div className="space-y-1.5">
              <Label>Preço para o cliente</Label>
              <div className="flex h-10 items-center rounded-md border border-primary/40 bg-primary/5 px-3 text-base font-bold text-primary">
                {brl(precoVenda)}
              </div>
              <p className="text-xs text-muted-foreground">Calculado sozinho.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fornecedor da peça</Label>
            <select
              value={form.fornecedor_id}
              onChange={(e) => setForm({ ...form, fornecedor_id: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="">Não informado</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome_fantasia || f.razao_social}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              De onde você compra a peça usada neste serviço.{" "}
              {!fornecedores.length && (
                <Link to="/fornecedores" className="font-medium text-primary hover:underline">
                  Cadastrar fornecedor
                </Link>
              )}
            </p>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tempo estimado (minutos)</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={form.tempo_estimado_min}
                onChange={(e) => setForm({ ...form, tempo_estimado_min: e.target.value })}
                placeholder="Ex: 60"
              />
              <p className="text-xs text-muted-foreground">
                Quanto tempo de bancada este serviço costuma levar.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Garantia (dias)</Label>
              <Input
                type="number"
                min={0}
                value={form.garantia_dias}
                onChange={(e) => setForm({ ...form, garantia_dias: e.target.value })}
                placeholder="Vazio = garantia padrão"
              />
              <p className="text-xs text-muted-foreground">
                Ao lançar este serviço na OS, o prazo de garantia da OS passa a ser o maior entre os
                serviços dela.
              </p>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <span>
              <span className="block text-sm font-medium">Serviço ativo</span>
              <span className="block text-xs text-muted-foreground">
                Inativo não aparece para lançar na OS, nas vendas nem no PDV.
              </span>
            </span>
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          </label>
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
          <Metrica label="Preço para o cliente" valor={brl(precoVenda)} />
          <Metrica label="Peça" valor={brl(custoAdicional)} />
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
