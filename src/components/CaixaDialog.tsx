// Controle de caixa do PDV: abertura com troco, sangria/suprimento e
// fechamento com conferência do dinheiro. As contas são feitas no banco
// (resumo_caixa / fechar_caixa) a partir dos lançamentos pagos do período em
// que o caixa ficou aberto.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Loader2,
  Lock,
  Printer,
  Unlock,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { brl as brlSempre } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type CaixaSessao = {
  id: string;
  status: "aberto" | "fechado";
  aberto_em: string;
  valor_abertura: number;
  fechado_em: string | null;
  valor_esperado: number | null;
  valor_contado: number | null;
  diferenca: number | null;
  resumo: ResumoCaixa | null;
  observacoes: string | null;
};

type ResumoCaixa = {
  formas: { forma: string; entradas: number; saidas: number }[];
  total_entradas: number;
  total_saidas: number;
  qtd_vendas: number;
  abertura: number;
  suprimentos: number;
  sangrias: number;
  dinheiro_entradas: number;
  dinheiro_saidas: number;
  dinheiro_esperado: number;
};

type Movimento = {
  id: string;
  tipo: "sangria" | "suprimento";
  valor: number;
  motivo: string | null;
  created_at: string;
};

const numero = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Caixa aberto da empresa + se a loja usa "Controle de caixa" (Configurações >
// Venda no balcão). Com controle ligado, o PDV só finaliza com caixa aberto.
export function useCaixa(empresaId: string | null | undefined) {
  const { data: caixa, isLoading } = useQuery({
    queryKey: ["caixa-aberto", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_sessoes")
        .select("*")
        .eq("user_id", empresaId!)
        .eq("status", "aberto")
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CaixaSessao) ?? null;
    },
  });
  const { data: controleAtivo = false } = useQuery({
    queryKey: ["sale-config-tipo-caixa", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("sale_config")
        .select("tipo_caixa")
        .eq("user_id", empresaId!)
        .maybeSingle();
      return (data as { tipo_caixa?: string } | null)?.tipo_caixa === "controle_caixa";
    },
  });
  return { caixa: caixa ?? null, carregando: isLoading, controleAtivo };
}

function imprimirFechamento(s: CaixaSessao) {
  const r = s.resumo;
  if (!r) return;
  const janela = window.open("", "_blank", "width=420,height=700");
  if (!janela) return;
  const linha = (a: string, b: string, forte = false) =>
    `<tr${forte ? ' class="forte"' : ""}><td>${a}</td><td>${b}</td></tr>`;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Fechamento de caixa</title>
    <style>
      body{font-family:system-ui,sans-serif;font-size:12px;margin:16px;color:#111}
      h1{font-size:16px;margin:0 0 4px} h2{font-size:13px;margin:16px 0 6px}
      p{margin:0;color:#555} table{width:100%;border-collapse:collapse}
      td{padding:3px 0;border-bottom:1px dashed #ccc} td:last-child{text-align:right}
      .forte td{font-weight:700;border-bottom:1px solid #111}
    </style></head><body>
    <h1>Fechamento de caixa</h1>
    <p>Aberto: ${dataHora(s.aberto_em)} · Fechado: ${s.fechado_em ? dataHora(s.fechado_em) : "—"}</p>
    <h2>Por forma de pagamento</h2>
    <table>
      ${r.formas.map((f) => linha(f.forma, `${brlSempre(f.entradas)}${f.saidas ? ` / −${brlSempre(f.saidas)}` : ""}`)).join("")}
      ${linha("Total de entradas", brlSempre(r.total_entradas), true)}
    </table>
    <h2>Dinheiro na gaveta</h2>
    <table>
      ${linha("Troco inicial", brlSempre(r.abertura))}
      ${linha("Entradas em dinheiro", brlSempre(r.dinheiro_entradas))}
      ${r.dinheiro_saidas ? linha("Saídas em dinheiro", `−${brlSempre(r.dinheiro_saidas)}`) : ""}
      ${r.suprimentos ? linha("Suprimentos", brlSempre(r.suprimentos)) : ""}
      ${r.sangrias ? linha("Sangrias", `−${brlSempre(r.sangrias)}`) : ""}
      ${linha("Esperado", brlSempre(s.valor_esperado ?? 0), true)}
      ${linha("Contado", brlSempre(s.valor_contado ?? 0))}
      ${linha("Diferença", brlSempre(s.diferenca ?? 0), true)}
    </table>
    ${s.observacoes ? `<h2>Observações</h2><p>${s.observacoes.replace(/</g, "&lt;")}</p>` : ""}
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  janela.document.close();
}

export function CaixaDialog({
  open,
  onOpenChange,
  empresaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string | null | undefined;
}) {
  const { formatFinancialValue: brl } = useFinancialVisibility();
  const qc = useQueryClient();
  const { caixa } = useCaixa(empresaId);
  const [valorAbertura, setValorAbertura] = useState("");
  const [movTipo, setMovTipo] = useState<"sangria" | "suprimento">("sangria");
  const [movValor, setMovValor] = useState("");
  const [movMotivo, setMovMotivo] = useState("");
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");

  const { data: resumo, isLoading: carregandoResumo } = useQuery({
    queryKey: ["caixa-resumo", caixa?.id],
    enabled: open && !!caixa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("resumo_caixa", { p_sessao_id: caixa!.id });
      if (error) throw error;
      return data as unknown as ResumoCaixa;
    },
  });

  const { data: movimentos = [] } = useQuery({
    queryKey: ["caixa-movimentos", caixa?.id],
    enabled: open && !!caixa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_movimentos")
        .select("id, tipo, valor, motivo, created_at")
        .eq("sessao_id", caixa!.id)
        .order("created_at");
      if (error) throw error;
      return data as unknown as Movimento[];
    },
  });

  const { data: fechados = [] } = useQuery({
    queryKey: ["caixa-fechados", empresaId],
    enabled: open && !caixa && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_sessoes")
        .select("*")
        .eq("user_id", empresaId!)
        .eq("status", "fechado")
        .order("fechado_em", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as unknown as CaixaSessao[];
    },
  });

  function atualizar() {
    qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
    qc.invalidateQueries({ queryKey: ["caixa-resumo"] });
    qc.invalidateQueries({ queryKey: ["caixa-movimentos"] });
    qc.invalidateQueries({ queryKey: ["caixa-fechados"] });
  }

  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("abrir_caixa", {
        p_empresa_id: empresaId!,
        p_valor_abertura: numero(valorAbertura),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa aberto");
      setValorAbertura("");
      atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const movimentar = useMutation({
    mutationFn: async () => {
      if (numero(movValor) <= 0) throw new Error("Informe o valor");
      const { error } = await supabase.rpc("movimentar_caixa", {
        p_sessao_id: caixa!.id,
        p_tipo: movTipo,
        p_valor: numero(movValor),
        p_motivo: movMotivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(movTipo === "sangria" ? "Sangria registrada" : "Suprimento registrado");
      setMovValor("");
      setMovMotivo("");
      atualizar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fechar = useMutation({
    mutationFn: async () => {
      if (contado.trim() === "") throw new Error("Conte o dinheiro da gaveta e informe o valor");
      const { data, error } = await supabase.rpc("fechar_caixa", {
        p_sessao_id: caixa!.id,
        p_valor_contado: numero(contado),
        p_observacoes: obs,
      });
      if (error) throw error;
      return data as unknown as CaixaSessao;
    },
    onSuccess: (s) => {
      const dif = Number(s.diferenca ?? 0);
      if (dif === 0) toast.success("Caixa fechado — dinheiro confere");
      else
        toast.warning(
          `Caixa fechado com ${dif > 0 ? "sobra" : "falta"} de ${brlSempre(Math.abs(dif))}`,
        );
      setContado("");
      setObs("");
      atualizar();
      imprimirFechamento(s);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const esperado = resumo?.dinheiro_esperado ?? 0;
  const diferencaPrevia =
    contado.trim() === "" ? null : Math.round((numero(contado) - esperado) * 100) / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {caixa ? `Caixa aberto desde ${hora(caixa.aberto_em)}` : "Caixa fechado"}
          </DialogTitle>
          {caixa && (
            <p className="text-sm text-muted-foreground">
              Aberto em {dataHora(caixa.aberto_em)} com {brl(caixa.valor_abertura)} de troco
            </p>
          )}
        </DialogHeader>

        {!caixa ? (
          <div className="space-y-5">
            <div className="space-y-2 rounded-2xl border border-border p-4">
              <Label>Troco inicial na gaveta</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={valorAbertura}
                onChange={(e) => setValorAbertura(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
              <Button
                className="w-full gap-2"
                onClick={() => abrir.mutate()}
                disabled={abrir.isPending}
              >
                <Unlock className="h-4 w-4" /> {abrir.isPending ? "Abrindo..." : "Abrir caixa"}
              </Button>
            </div>

            {fechados.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Últimos fechamentos
                </p>
                <ul className="divide-y divide-border rounded-2xl border border-border">
                  {fechados.map((s) => {
                    const dif = Number(s.diferenca ?? 0);
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {s.fechado_em ? dataHora(s.fechado_em) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Entradas {brl(s.resumo?.total_entradas ?? 0)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            dif === 0
                              ? "text-emerald-600"
                              : dif > 0
                                ? "text-amber-600"
                                : "text-red-600",
                          )}
                        >
                          {dif === 0
                            ? "Conferido"
                            : `${dif > 0 ? "Sobra" : "Falta"} ${brl(Math.abs(dif))}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => imprimirFechamento(s)}
                          className="p-1.5 text-muted-foreground hover:text-foreground"
                          aria-label="Imprimir fechamento"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        ) : carregandoResumo || !resumo ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Recebido neste caixa · {resumo.qtd_vendas}{" "}
                {resumo.qtd_vendas === 1 ? "venda" : "vendas"}
              </p>
              <div className="divide-y divide-border rounded-2xl border border-border text-sm">
                {resumo.formas.length === 0 && (
                  <p className="px-3 py-3 text-muted-foreground">Nenhum lançamento ainda.</p>
                )}
                {resumo.formas.map((f) => (
                  <div key={f.forma} className="flex items-center justify-between px-3 py-2">
                    <span>{f.forma}</span>
                    <span className="text-right">
                      {f.entradas > 0 && <span className="font-semibold">{brl(f.entradas)}</span>}
                      {f.saidas > 0 && (
                        <span className="ml-2 text-xs text-red-600">− {brl(f.saidas)}</span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-muted/40 px-3 py-2 font-bold">
                  <span>Total de entradas</span>
                  <span>{brl(resumo.total_entradas)}</span>
                </div>
              </div>
              {resumo.formas.some((f) => f.forma === "Não informado" && f.saidas > 0) && (
                <p className="text-xs text-muted-foreground">
                  Saídas sem forma de pagamento não entram na conta do dinheiro. Se pagou algo com o
                  dinheiro da gaveta, registre uma sangria.
                </p>
              )}
            </div>

            <div className="space-y-1.5 rounded-2xl border border-border p-3 text-sm">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dinheiro na gaveta
              </p>
              <Linha label="Troco inicial" valor={brl(resumo.abertura)} />
              <Linha label="Entradas em dinheiro" valor={`+ ${brl(resumo.dinheiro_entradas)}`} />
              {resumo.dinheiro_saidas > 0 && (
                <Linha label="Saídas em dinheiro" valor={`− ${brl(resumo.dinheiro_saidas)}`} />
              )}
              {resumo.suprimentos > 0 && (
                <Linha label="Suprimentos" valor={`+ ${brl(resumo.suprimentos)}`} />
              )}
              {resumo.sangrias > 0 && (
                <Linha label="Sangrias" valor={`− ${brl(resumo.sangrias)}`} />
              )}
              <div className="flex items-center justify-between border-t border-border pt-1.5 font-bold">
                <span>Esperado</span>
                <span className="text-primary">{brl(esperado)}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-border p-3">
              <div className="flex gap-1 rounded-xl bg-muted p-1">
                {(["sangria", "suprimento"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMovTipo(t)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold",
                      movTipo === t ? "bg-background shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {t === "sangria" ? (
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownCircle className="h-3.5 w-3.5" />
                    )}
                    {t === "sangria" ? "Sangria (retirar)" : "Suprimento (colocar)"}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={movValor}
                  onChange={(e) => setMovValor(e.target.value)}
                  placeholder="Valor"
                  className="w-28"
                />
                <Input
                  value={movMotivo}
                  onChange={(e) => setMovMotivo(e.target.value.slice(0, 200))}
                  placeholder={
                    movTipo === "sangria"
                      ? "Motivo (ex.: cofre, pagar motoboy)"
                      : "Motivo (ex.: troco)"
                  }
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => movimentar.mutate()}
                  disabled={movimentar.isPending}
                >
                  Lançar
                </Button>
              </div>
              {movimentos.length > 0 && (
                <ul className="space-y-1 pt-1 text-xs">
                  {movimentos.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between text-muted-foreground"
                    >
                      <span className="truncate">
                        {hora(m.created_at)} · {m.tipo === "sangria" ? "Sangria" : "Suprimento"}
                        {m.motivo ? ` · ${m.motivo}` : ""}
                      </span>
                      <span className={m.tipo === "sangria" ? "text-red-600" : "text-emerald-600"}>
                        {m.tipo === "sangria" ? "−" : "+"} {brl(m.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <Label>Dinheiro contado na gaveta</Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={contado}
                onChange={(e) => setContado(e.target.value)}
                placeholder="0,00"
              />
              {diferencaPrevia !== null && (
                <p
                  className={cn(
                    "text-sm font-semibold",
                    diferencaPrevia === 0
                      ? "text-emerald-600"
                      : diferencaPrevia > 0
                        ? "text-amber-600"
                        : "text-red-600",
                  )}
                >
                  {diferencaPrevia === 0
                    ? "Confere com o esperado"
                    : `${diferencaPrevia > 0 ? "Sobra" : "Falta"} de ${brlSempre(Math.abs(diferencaPrevia))}`}
                </p>
              )}
              <Input
                value={obs}
                onChange={(e) => setObs(e.target.value.slice(0, 500))}
                placeholder="Observações (opcional)"
              />
              <Button
                className="w-full gap-2"
                onClick={() => fechar.mutate()}
                disabled={fechar.isPending}
              >
                <Lock className="h-4 w-4" /> {fechar.isPending ? "Fechando..." : "Fechar caixa"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{valor}</span>
    </div>
  );
}
