// Create/edit form for a single unit in the Aparelhos module (pedido, seção
// 5) — same Dialog + plain Label/Input/Select recipe seminovos.tsx/
// compras.tsx use, no new form library. Writes straight to `aparelhos` via
// the browser client (RLS already gates on has_permission('aparelhos',
// 'gerenciar')) — no server function needed here, matching how every other
// module's simple CRUD works in this app.
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/MoneyInput";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AparelhoFotos } from "@/components/AparelhoFotos";
import type { Database } from "@/integrations/supabase/types";

type AparelhoRow = Database["public"]["Tables"]["aparelhos"]["Row"];

const CHECKLIST_ITENS: { key: string; label: string }[] = [
  { key: "tela", label: "Tela" },
  { key: "bateria", label: "Bateria" },
  { key: "camera", label: "Câmeras" },
  { key: "alto_falante", label: "Alto-falante" },
  { key: "microfone", label: "Microfone" },
  { key: "biometria", label: "Biometria" },
  { key: "face_id", label: "Face ID" },
  { key: "touch_id", label: "Touch ID" },
  { key: "conector", label: "Conector de carga" },
  { key: "carcaca", label: "Carcaça" },
];

const CHECKLIST_STATUS: { value: string; label: string }[] = [
  { value: "ok", label: "OK" },
  { value: "com_detalhe", label: "Com detalhe" },
  { value: "nao_testado", label: "Não testado" },
  { value: "nao_possui", label: "Não possui" },
];

type FormState = {
  tipo: "lacrado" | "seminovo";
  marca: string;
  modelo: string;
  variante: string;
  armazenamento: string;
  ram: string;
  cor: string;
  imei1: string;
  imei2: string;
  numero_serie: string;
  estado_conservacao: string;
  saude_bateria: string;
  ciclos_bateria: string;
  preco_custo: number;
  preco_venda: number;
  observacoes: string;
  checklist: Record<string, string>;
};

const formVazio: FormState = {
  tipo: "lacrado",
  marca: "",
  modelo: "",
  variante: "",
  armazenamento: "",
  ram: "",
  cor: "",
  imei1: "",
  imei2: "",
  numero_serie: "",
  estado_conservacao: "",
  saude_bateria: "",
  ciclos_bateria: "",
  preco_custo: 0,
  preco_venda: 0,
  observacoes: "",
  checklist: {},
};

export function CadastroAparelhoModal({
  open,
  onOpenChange,
  aparelho,
  empresaId,
  podeVerCusto,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aparelho: AparelhoRow | null;
  empresaId: string;
  podeVerCusto: boolean;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(formVazio);

  useEffect(() => {
    if (!open) return;
    if (aparelho) {
      setForm({
        tipo: aparelho.tipo as "lacrado" | "seminovo",
        marca: aparelho.marca,
        modelo: aparelho.modelo,
        variante: aparelho.variante ?? "",
        armazenamento: aparelho.armazenamento ?? "",
        ram: aparelho.ram ?? "",
        cor: aparelho.cor ?? "",
        imei1: aparelho.imei1 ?? "",
        imei2: aparelho.imei2 ?? "",
        numero_serie: aparelho.numero_serie ?? "",
        estado_conservacao: aparelho.estado_conservacao ?? "",
        saude_bateria: aparelho.saude_bateria != null ? String(aparelho.saude_bateria) : "",
        ciclos_bateria: aparelho.ciclos_bateria != null ? String(aparelho.ciclos_bateria) : "",
        preco_custo: Number(aparelho.preco_custo ?? 0),
        preco_venda: Number(aparelho.preco_venda ?? 0),
        observacoes: aparelho.observacoes ?? "",
        checklist: (aparelho.checklist as Record<string, string> | null) ?? {},
      });
    } else {
      setForm(formVazio);
    }
  }, [open, aparelho]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.marca.trim()) throw new Error("Informe a marca.");
      if (!form.modelo.trim()) throw new Error("Informe o modelo.");
      if (form.preco_venda < 0) throw new Error("O valor de venda não pode ser negativo.");
      if (form.preco_custo < 0) throw new Error("O valor de custo não pode ser negativo.");

      const payload = {
        user_id: empresaId,
        tipo: form.tipo,
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        variante: form.variante.trim() || null,
        armazenamento: form.armazenamento.trim() || null,
        ram: form.ram.trim() || null,
        cor: form.cor.trim() || null,
        imei1: form.imei1.replace(/\D/g, "") || null,
        imei2: form.imei2.replace(/\D/g, "") || null,
        numero_serie: form.numero_serie.trim() || null,
        estado_conservacao:
          form.tipo === "seminovo" ? form.estado_conservacao.trim() || null : null,
        saude_bateria:
          form.tipo === "seminovo" && form.saude_bateria ? Number(form.saude_bateria) : null,
        ciclos_bateria:
          form.tipo === "seminovo" && form.ciclos_bateria ? Number(form.ciclos_bateria) : null,
        // Custo só é gravado por quem pode vê-lo — quem não pode nunca
        // envia esse campo no payload (fica escondido no formulário), então
        // uma edição feita por um atendente simplesmente não altera o custo
        // já existente.
        ...(podeVerCusto ? { preco_custo: form.preco_custo } : {}),
        preco_venda: form.preco_venda,
        observacoes: form.observacoes.trim() || null,
        checklist: form.tipo === "seminovo" ? form.checklist : {},
      };

      if (aparelho) {
        const { error } = await supabase.from("aparelhos").update(payload).eq("id", aparelho.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("aparelhos")
          .insert({ ...payload, created_by: empresaId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(aparelho ? "Aparelho atualizado" : "Aparelho cadastrado");
      qc.invalidateQueries({ queryKey: ["aparelhos"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lucro = form.preco_venda - form.preco_custo;
  const margem = form.preco_venda > 0 ? (lucro / form.preco_venda) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{aparelho ? "Editar aparelho" : "Novo aparelho"}</span>
            {aparelho && (
              <AparelhoFotos
                aparelhoId={aparelho.id}
                empresaId={empresaId}
                trigger={
                  <Button variant="outline" size="sm" type="button">
                    Fotos
                  </Button>
                }
              />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as "lacrado" | "seminovo" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lacrado">Lacrado</SelectItem>
                <SelectItem value="seminovo">Seminovo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Marca *</Label>
              <Input
                value={form.marca}
                onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo *</Label>
              <Input
                value={form.modelo}
                onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Variante</Label>
              <Input
                value={form.variante}
                onChange={(e) => setForm((f) => ({ ...f, variante: e.target.value }))}
                placeholder="Pro, Max, Plus..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Armazenamento</Label>
              <Input
                value={form.armazenamento}
                onChange={(e) => setForm((f) => ({ ...f, armazenamento: e.target.value }))}
                placeholder="128GB"
              />
            </div>
            <div className="space-y-1.5">
              <Label>RAM</Label>
              <Input
                value={form.ram}
                onChange={(e) => setForm((f) => ({ ...f, ram: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Input
                value={form.cor}
                onChange={(e) => setForm((f) => ({ ...f, cor: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IMEI 1</Label>
              <Input
                inputMode="numeric"
                value={form.imei1}
                onChange={(e) => setForm((f) => ({ ...f, imei1: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>IMEI 2</Label>
              <Input
                inputMode="numeric"
                value={form.imei2}
                onChange={(e) => setForm((f) => ({ ...f, imei2: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número de série</Label>
              <Input
                value={form.numero_serie}
                onChange={(e) => setForm((f) => ({ ...f, numero_serie: e.target.value }))}
              />
            </div>
          </div>

          {form.tipo === "seminovo" && (
            <div className="space-y-4 rounded-xl border border-dashed border-border p-4">
              <p className="text-sm font-semibold text-foreground">Avaliação do seminovo</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Estado de conservação</Label>
                  <Input
                    value={form.estado_conservacao}
                    onChange={(e) => setForm((f) => ({ ...f, estado_conservacao: e.target.value }))}
                    placeholder="Excelente, bom, regular..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Saúde da bateria (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.saude_bateria}
                    onChange={(e) => setForm((f) => ({ ...f, saude_bateria: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Ciclos da bateria</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.ciclos_bateria}
                    onChange={(e) => setForm((f) => ({ ...f, ciclos_bateria: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">Checklist de avaliação</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CHECKLIST_ITENS.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-normal">{item.label}</Label>
                      <Select
                        value={form.checklist[item.key] ?? "nao_testado"}
                        onValueChange={(v) =>
                          setForm((f) => ({ ...f, checklist: { ...f.checklist, [item.key]: v } }))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHECKLIST_STATUS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {podeVerCusto && (
              <div className="space-y-1.5">
                <Label>Valor de custo</Label>
                <MoneyInput
                  value={form.preco_custo}
                  onChange={(v) => setForm((f) => ({ ...f, preco_custo: v }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Valor de venda</Label>
              <MoneyInput
                value={form.preco_venda}
                onChange={(v) => setForm((f) => ({ ...f, preco_venda: v }))}
              />
            </div>
          </div>

          {podeVerCusto && (
            <div className="flex items-center gap-6 rounded-xl bg-secondary/40 px-4 py-3 text-sm">
              <span>
                Lucro:{" "}
                <strong className={lucro >= 0 ? "text-emerald-600" : "text-destructive"}>
                  {brl(lucro)}
                </strong>
              </span>
              <span>
                Margem: <strong>{margem.toFixed(2)}%</strong>
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
