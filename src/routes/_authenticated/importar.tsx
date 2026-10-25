import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Loader2,
  Package,
  Truck,
  Undo2,
  Upload,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";
import {
  TIPOS_IMPORTACAO,
  chaveDuplicado,
  limparLinha,
  mapearColunas,
  type LinhaLimpa,
  type TipoImportacao,
  type ValorBruto,
} from "@/lib/importacao/campos";
import {
  desfazerImportacao,
  importarLote,
  listarImportacoes,
  type Importacao,
  type ResultadoLote,
} from "@/lib/importacao/importacao.functions";

export const Route = createFileRoute("/_authenticated/importar")({
  head: () => ({
    meta: [{ title: "Importar dados — SpaceTech" }],
  }),
  component: ImportarDados,
});

const ICONES: Record<TipoImportacao, typeof Users> = {
  clientes: Users,
  fornecedores: Truck,
  produtos: Package,
  servicos: Wrench,
};
const LOTE = 250;
const MAX_LINHAS = 20000;
const SEM_COLUNA = "__nenhuma";

type Planilha = { arquivo: string; colunas: string[]; linhas: ValorBruto[][] };

function celula(v: unknown): ValorBruto {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return null;
}

// CSV de sistema antigo muitas vezes vem em Windows-1252, não UTF-8.
function decodificar(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function lerPlanilha(arquivo: File): Promise<Planilha> {
  const nome = arquivo.name.toLowerCase();
  let linhas: ValorBruto[][];
  if (nome.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file");
    const brutas = await readXlsxFile(arquivo);
    linhas = brutas.map((l) => l.map(celula));
  } else if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    const Papa = (await import("papaparse")).default;
    const texto = decodificar(await arquivo.arrayBuffer());
    const r = Papa.parse<string[]>(texto.replace(/^\uFEFF/, ""), { skipEmptyLines: true });
    linhas = r.data.map((l) => l.map(celula));
  } else if (nome.endsWith(".xls")) {
    throw new Error(
      "Arquivo .xls (Excel antigo) não é suportado. Abra no Excel e salve como .xlsx ou .csv.",
    );
  } else {
    throw new Error("Envie uma planilha .xlsx ou .csv.");
  }

  const vazia = (l: ValorBruto[]) => l.every((v) => v === null || String(v).trim() === "");
  const inicio = linhas.findIndex((l) => !vazia(l));
  if (inicio < 0) throw new Error("A planilha está vazia.");
  const colunas = linhas[inicio]!.map((c, i) => String(c ?? "").trim() || `Coluna ${i + 1}`);
  const dados = linhas.slice(inicio + 1).filter((l) => !vazia(l));
  if (!dados.length) throw new Error("A planilha só tem o cabeçalho, nenhuma linha de dados.");
  if (dados.length > MAX_LINHAS) {
    throw new Error(
      `A planilha tem ${dados.length} linhas. Divida em arquivos de até ${MAX_LINHAS}.`,
    );
  }
  return { arquivo: arquivo.name, colunas, linhas: dados };
}

function baixarModelo(tipo: TipoImportacao) {
  const campos = TIPOS_IMPORTACAO[tipo].campos;
  const csv = "\uFEFF" + campos.map((c) => c.rotulo).join(";") + "\r\n";
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `modelo-importacao-${tipo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportarDados() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoImportacao | null>(null);
  const [planilha, setPlanilha] = useState<Planilha | null>(null);
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [resultado, setResultado] = useState<{
    inseridos: number;
    duplicados: number;
    invalidos: number;
  } | null>(null);
  const [desfazer, setDesfazer] = useState<Importacao | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const historico = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => listarImportacoes(),
  });

  const recomecar = () => {
    setPlanilha(null);
    setMapa({});
    setResultado(null);
    setProgresso(null);
  };

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo || !tipo) return;
    setLendo(true);
    try {
      const p = await lerPlanilha(arquivo);
      setPlanilha(p);
      setMapa(mapearColunas(tipo, p.colunas));
      setResultado(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a planilha.");
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Linhas já ligadas aos campos e limpas — a prévia e o envio usam as mesmas.
  const analise = useMemo(() => {
    if (!tipo || !planilha) return null;
    const ligadas = planilha.linhas.map((linha) => {
      const bruta: Record<string, ValorBruto> = {};
      for (const [campo, coluna] of Object.entries(mapa)) bruta[campo] = linha[coluna] ?? null;
      return bruta;
    });
    const limpas: LinhaLimpa[] = ligadas.map((b) => limparLinha(tipo, b));
    const vistas = new Set<string>();
    let repetidas = 0;
    for (const l of limpas) {
      if (l.erro) continue;
      const chave = chaveDuplicado(tipo, l.dados);
      if (vistas.has(chave)) repetidas++;
      vistas.add(chave);
    }
    return {
      ligadas,
      limpas,
      invalidas: limpas.filter((l) => l.erro).length,
      comAviso: limpas.filter((l) => !l.erro && l.avisos.length).length,
      repetidas,
    };
  }, [tipo, planilha, mapa]);

  const importar = useMutation({
    mutationFn: async () => {
      if (!tipo || !planilha || !analise) return null;
      let importacaoId: string | null = null;
      const total = { inseridos: 0, duplicados: 0, invalidos: 0 };
      setProgresso(0);
      for (let i = 0; i < analise.ligadas.length; i += LOTE) {
        const r: ResultadoLote = await importarLote({
          data: {
            tipo,
            importacaoId,
            arquivo: planilha.arquivo.slice(0, 200),
            linhas: analise.ligadas.slice(i, i + LOTE),
          },
        });
        importacaoId = r.importacaoId;
        total.inseridos += r.inseridos;
        total.duplicados += r.duplicados;
        total.invalidos += r.invalidos;
        setProgresso(Math.min(100, Math.round(((i + LOTE) / analise.ligadas.length) * 100)));
      }
      return total;
    },
    onSuccess: (total) => {
      if (!total) return;
      setResultado(total);
      toast.success(`${total.inseridos} registro(s) importado(s).`);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      qc.invalidateQueries();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: ["importacoes"] });
    },
    onSettled: () => setProgresso(null),
  });

  const desfazerMut = useMutation({
    mutationFn: (id: string) => desfazerImportacao({ data: { importacaoId: id } }),
    onSuccess: (r) => {
      toast.success(
        r.mantidos
          ? `${r.apagados} apagado(s). ${r.mantidos} ficaram porque já foram usados (OS, vendas etc.).`
          : `Importação desfeita: ${r.apagados} registro(s) apagado(s).`,
      );
      setDesfazer(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setDesfazer(null);
    },
  });

  const config = tipo ? TIPOS_IMPORTACAO[tipo] : null;
  const obrigatorio = config?.campos.find((c) => c.obrigatorio);
  const faltaObrigatorio = obrigatorio ? mapa[obrigatorio.chave] === undefined : true;
  // Repetidas na própria planilha entram uma vez só.
  const prontas = analise ? analise.limpas.length - analise.invalidas - analise.repetidas : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar dados"
        subtitle="Traga clientes, fornecedores, produtos e serviços de outro sistema por planilha"
      />

      {/* 1. O que importar */}
      {!tipo && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(TIPOS_IMPORTACAO) as TipoImportacao[]).map((t) => {
            const Icone = ICONES[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className="rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition hover:border-primary hover:bg-primary/5"
              >
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icone className="h-5 w-5" />
                </span>
                <p className="font-semibold">{TIPOS_IMPORTACAO[t].rotulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {TIPOS_IMPORTACAO[t].descricao}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* 2. Arquivo */}
      {tipo && config && !planilha && (
        <SectionCard
          title={`Importar ${config.rotulo.toLowerCase()}`}
          subtitle="Exporte do sistema antigo em Excel (.xlsx) ou CSV e envie aqui."
          icon={ICONES[tipo]}
          action={
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => setTipo(null)}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
          }
        >
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-10 text-center transition hover:border-primary hover:bg-primary/5",
              lendo && "pointer-events-none opacity-60",
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void escolherArquivo(e.dataTransfer.files[0]);
            }}
          >
            {lendo ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-primary" />
            )}
            <span className="font-medium">
              {lendo ? "Lendo planilha..." : "Clique ou arraste a planilha aqui"}
            </span>
            <span className="text-xs text-muted-foreground">
              .xlsx ou .csv · a primeira linha deve ter os nomes das colunas
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv,.txt"
              className="hidden"
              onChange={(e) => void escolherArquivo(e.target.files?.[0])}
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Não tem como exportar? Baixe o modelo, preencha no Excel e envie.</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => baixarModelo(tipo)}
            >
              <Download className="h-4 w-4" /> Baixar modelo
            </Button>
          </div>
        </SectionCard>
      )}

      {/* 3. Ligar colunas + prévia */}
      {tipo && config && planilha && analise && !resultado && (
        <>
          <SectionCard
            title="Ligue as colunas"
            subtitle={`${planilha.arquivo} · ${planilha.linhas.length} linha(s). Conferimos os nomes das colunas sozinhos — ajuste o que estiver errado.`}
            icon={FileSpreadsheet}
            action={
              <Button variant="ghost" size="sm" className="gap-1" onClick={recomecar}>
                <ArrowLeft className="h-4 w-4" /> Trocar arquivo
              </Button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {config.campos.map((campo) => (
                <div key={campo.chave} className="space-y-1">
                  <p className="text-sm font-medium">
                    {campo.rotulo}
                    {campo.obrigatorio && <span className="text-destructive"> *</span>}
                  </p>
                  <Select
                    value={mapa[campo.chave] === undefined ? SEM_COLUNA : String(mapa[campo.chave])}
                    onValueChange={(v) =>
                      setMapa((m) => {
                        const novo = { ...m };
                        if (v === SEM_COLUNA) delete novo[campo.chave];
                        else novo[campo.chave] = Number(v);
                        return novo;
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_COLUNA}>— não importar —</SelectItem>
                      {planilha.colunas.map((c, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Prévia" subtitle="As primeiras 10 linhas como vão ficar no sistema.">
            <div className="mb-4 flex flex-wrap gap-2">
              <StatusBadge label={`${prontas} prontas para importar`} tone="success" />
              {analise.comAviso > 0 && (
                <StatusBadge label={`${analise.comAviso} com aviso`} tone="warning" />
              )}
              {analise.invalidas > 0 && (
                <StatusBadge label={`${analise.invalidas} serão puladas`} tone="danger" />
              )}
              {analise.repetidas > 0 && (
                <StatusBadge label={`${analise.repetidas} repetidas na planilha`} tone="neutral" />
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    {Object.keys(analise.limpas[0]?.dados ?? {}).map((k) => (
                      <th key={k} className="whitespace-nowrap px-3 py-2">
                        {config.campos.find((c) => c.chave === k)?.rotulo ?? k}
                      </th>
                    ))}
                    <th className="px-3 py-2">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.limpas.slice(0, 10).map((l, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-muted-foreground">{i + 2}</td>
                      {Object.entries(l.dados).map(([k, v]) => (
                        <td key={k} className="max-w-[220px] truncate px-3 py-2">
                          {v === null
                            ? "—"
                            : typeof v === "number" && k.startsWith("preco")
                              ? brl(v)
                              : k === "data_nascimento"
                                ? String(v).split("-").reverse().join("/")
                                : String(v)}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2 text-xs">
                        {l.erro ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <XCircle className="h-3.5 w-3.5" /> {l.erro}
                          </span>
                        ) : l.avisos.length ? (
                          <span className="flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> {l.avisos.join("; ")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Registros que já existem no sistema (mesmo CPF/CNPJ, telefone, código ou nome) são
              pulados automaticamente. Dá para desfazer a importação depois.
            </p>

            {progresso !== null && <Progress value={progresso} className="mt-4" />}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="gap-2"
                disabled={faltaObrigatorio || prontas === 0 || importar.isPending}
                onClick={() => importar.mutate()}
              >
                {importar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {importar.isPending
                  ? `Importando... ${progresso ?? 0}%`
                  : `Importar ${prontas} ${config.rotulo.toLowerCase()}`}
              </Button>
              {faltaObrigatorio && obrigatorio && (
                <span className="self-center text-sm text-destructive">
                  Escolha a coluna de “{obrigatorio.rotulo}”.
                </span>
              )}
            </div>
          </SectionCard>
        </>
      )}

      {/* 4. Resultado */}
      {tipo && config && resultado && (
        <SectionCard title="Importação concluída" icon={CheckCircle2}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-green-500/10 p-4">
              <p className="text-2xl font-bold text-green-600">{resultado.inseridos}</p>
              <p className="text-sm text-muted-foreground">importados</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-2xl font-bold">{resultado.duplicados}</p>
              <p className="text-sm text-muted-foreground">já existiam (pulados)</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-2xl font-bold">{resultado.invalidos}</p>
              <p className="text-sm text-muted-foreground">
                sem {obrigatorio?.rotulo.toLowerCase()} (pulados)
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link
                to={
                  tipo === "clientes"
                    ? "/clientes"
                    : tipo === "fornecedores"
                      ? "/fornecedores"
                      : tipo === "servicos"
                        ? "/servicos"
                        : "/estoque"
                }
              >
                Ver {config.rotulo.toLowerCase()}
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                recomecar();
                setTipo(null);
              }}
            >
              Importar outra planilha
            </Button>
          </div>
        </SectionCard>
      )}

      {/* Histórico */}
      <SectionCard
        title="Importações anteriores"
        subtitle="Desfazer apaga o que foi importado e ainda não foi usado em OS, vendas ou compras."
        icon={History}
      >
        {historico.isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : !historico.data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação feita ainda.</p>
        ) : (
          <div className="divide-y divide-border">
            {historico.data.map((imp) => (
              <div key={imp.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {TIPOS_IMPORTACAO[imp.tipo].rotulo} · {imp.arquivo ?? "planilha"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(imp.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    · {imp.inseridos} importado(s) · {imp.pulados} pulado(s)
                  </p>
                </div>
                {imp.desfeita_em ? (
                  <StatusBadge
                    label={
                      imp.desfeita_mantidos
                        ? `Desfeita (${imp.desfeita_mantidos} mantidos)`
                        : "Desfeita"
                    }
                    tone="neutral"
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={imp.inseridos === 0}
                    onClick={() => setDesfazer(imp)}
                  >
                    <Undo2 className="h-4 w-4" /> Desfazer
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <ConfirmDialog
        open={!!desfazer}
        onOpenChange={(o) => !o && setDesfazer(null)}
        title="Desfazer esta importação?"
        description={
          desfazer
            ? `Os ${desfazer.inseridos} registro(s) importados de "${desfazer.arquivo ?? "planilha"}" serão apagados, menos os que já foram usados em OS, vendas, compras etc.`
            : ""
        }
        confirmLabel="Desfazer"
        destructive
        loading={desfazerMut.isPending}
        onConfirm={() => desfazer && desfazerMut.mutate(desfazer.id)}
      />
    </div>
  );
}
