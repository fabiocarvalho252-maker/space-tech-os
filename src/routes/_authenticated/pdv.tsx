import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { 
  ShoppingCart, 
  Trash2, 
  FileCheck, 
  Search, 
  Plus, 
  Minus, 
  User, 
  ChevronDown, 
  Clock,
  Package,
  Wrench,
  ClipboardList
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, useEmpresaId } from "@/hooks/useCurrentUser";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — SpaceTech" },
      { name: "description", content: "Frente de caixa rápida e intuitiva." },
      { property: "og:title", content: "PDV — SpaceTech" },
    ],
  }),
  component: PDV,
});

type Item = {
  id: string;
  nome: string;
  preco: number;
  qtd: number;
  estoque: number;
  tipo: 'Produto' | 'Serviço';
};

// "10*iphone" -> busca por "iphone" com 10 unidades por clique/leitura, igual
// ao placeholder do campo de busca sempre prometeu mas nunca implementou.
function parseBusca(busca: string): { termo: string; qtd: number } {
  const m = busca.match(/^(\d+)\*(.*)$/);
  if (!m) return { termo: busca, qtd: 1 };
  return { termo: m[2] ?? "", qtd: Math.max(1, parseInt(m[1]!, 10) || 1) };
}

function tipoDoItem(categoria: string | null): 'Produto' | 'Serviço' {
  return categoria === 'Serviço' ? 'Serviço' : 'Produto';
}

function PDV() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const empresaId = useEmpresaId();
  const [carrinho, setCarrinho] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<'Tudo' | 'Produto' | 'Serviço'>('Tudo');
  const [observacoes, setObservacoes] = useState("");
  const [clienteId, setClienteId] = useState<string | null>(null);

  const { data: produtos = [] } = useQuery({
    queryKey: ["pdv-itens"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("*").order("nome");
      return data ?? [];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-pdv"],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const selectedCliente = useMemo(() => 
    clientes.find(c => c.id === clienteId)?.nome || "Consumidor Final",
  [clientes, clienteId]);

  const subtotal = carrinho.reduce((s, i) => s + i.preco * i.qtd, 0);
  const total = subtotal;

  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString('pt-BR');
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  function adicionar(p: any, qtdAdicional = 1) {
    const tipo = tipoDoItem(p.categoria);
    setCarrinho((c) => {
      const existe = c.find((i) => i.id === p.id);
      const qtdFinal = (existe?.qtd ?? 0) + qtdAdicional;
      if (qtdFinal > (p.quantidade || 0)) {
        toast.error("Limite de estoque atingido");
        return c;
      }
      if (existe) {
        return c.map((i) => (i.id === p.id ? { ...i, qtd: qtdFinal } : i));
      }
      return [
        ...c,
        {
          id: p.id,
          nome: p.nome,
          preco: Number(p.preco_venda),
          qtd: qtdAdicional,
          estoque: p.quantidade || 0,
          tipo,
        },
      ];
    });
  }

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!carrinho.length) throw new Error("Carrinho vazio");
      if (!user) throw new Error("Usuário não autenticado");
      
      const { data: venda, error: vendaErro } = await supabase
        .from("vendas")
        .insert({
          user_id: empresaId!,
          cliente_id: clienteId,
          total,
          forma_pagamento: "pix",
        })
        .select()
        .single();
      
      if (vendaErro) throw vendaErro;
      if (!venda) throw new Error("Erro ao criar venda");

      const { error: itensErro } = await supabase.from("venda_itens").insert(
        carrinho.map(i => ({
          user_id: empresaId!,
          venda_id: (venda as any).id,
          produto_id: i.id,
          descricao: i.nome,
          quantidade: i.qtd,
          preco_unitario: i.preco
        }))
      );

      if (itensErro) throw itensErro;

      for (const item of carrinho) {
        if (item.tipo === 'Produto') {
          const { data: p } = await supabase.from('produtos').select('quantidade').eq('id', item.id).single();
          if (p) {
             await supabase.from('produtos').update({ quantidade: Math.max(0, p.quantidade - item.qtd) }).eq('id', item.id);
          }
        }
      }

      await supabase.from("lancamentos").insert({
        user_id: empresaId!,
        tipo: "entrada",
        categoria: "Venda PDV",
        descricao: `Venda #${(venda as any).id.slice(0, 8)}`,
        valor: total,
      });
    },
    onSuccess: () => {
      toast.success("Venda finalizada com sucesso!");
      setCarrinho([]);
      setObservacoes("");
      setClienteId(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { termo: termoBusca, qtd: qtdBusca } = parseBusca(busca);

  const filtrados = produtos.filter(p => {
    if (filtroTipo !== 'Tudo' && tipoDoItem(p.categoria) !== filtroTipo) return false;
    return (
      p.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(termoBusca.toLowerCase()))
    );
  });

  const userName = user?.email?.split('@')?.[0]?.replace(/\./g, ' ') || 'Usuário';

  return (
    <div className="flex flex-col gap-6 lg:h-[calc(100vh-120px)] lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">PDV</h1>
            <p className="truncate text-sm text-muted-foreground">
              Boa noite, <span className="font-semibold text-foreground uppercase">{userName}</span>
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{dataFormatada}</span>
            <span className="text-muted-foreground">|</span>
            <span>{horaFormatada}</span>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_400px] lg:overflow-hidden">
        <div className="flex flex-col gap-4 lg:overflow-hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-xl bg-primary/5 text-primary hover:bg-primary/10"
              onClick={() => {
                if (!carrinho.length && !observacoes && !clienteId) return;
                setCarrinho([]);
                setObservacoes("");
                setClienteId(null);
                setBusca("");
                toast.success("Nova venda iniciada");
              }}
            >
              <Plus className="h-4 w-4" /> Nova venda
            </Button>
            <Button
              variant="ghost"
              className="h-10 gap-2 rounded-xl hover:bg-muted"
              onClick={() => navigate({ to: "/ordens" })}
            >
              <ClipboardList className="h-4 w-4" /> Entregar OS
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  const exato = produtos.find(
                    p => p.sku && p.sku.toLowerCase() === termoBusca.trim().toLowerCase(),
                  );
                  if (!exato) return;
                  adicionar(exato, qtdBusca);
                  setBusca("");
                }}
                placeholder="Qtde*nome — ex: 10*iphone ou código de barras"
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
              {(['Tudo', 'Produto', 'Serviço'] as const).map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant="ghost"
                  onClick={() => setFiltroTipo(t)}
                  className={`h-8 rounded-lg ${
                    filtroTipo === t ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  }`}
                >
                  {t === 'Tudo' ? 'Tudo' : t === 'Produto' ? 'Produtos' : 'Serviços'}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {filtrados.map(p => {
                const tipo = tipoDoItem(p.categoria);
                const Icone = tipo === 'Serviço' ? Wrench : Package;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      adicionar(p, qtdBusca);
                      setBusca("");
                    }}
                    className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted/50 flex items-center justify-center">
                      <Icone className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="truncate text-xs font-semibold leading-tight">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{p.categoria || tipo}</p>
                      <p className="text-sm font-bold text-primary">{brl(p.preco_venda)}</p>
                    </div>
                    {tipo === 'Produto' && p.quantidade <= 5 && (
                      <span className="absolute right-2 top-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                        {p.quantidade}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl border border-border bg-card shadow-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Itens da Venda
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
              {carrinho.length} Itens
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-border">
            {carrinho.map(item => (
              <div key={item.id} className="group flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  {item.tipo === 'Serviço' ? <Wrench className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.nome}</p>
                  <p className="text-xs text-muted-foreground">{brl(item.preco)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCarrinho(c => c.map(x => x.id === item.id ? {...x, qtd: Math.max(1, x.qtd - 1)} : x))}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-4 text-center text-sm font-bold">{item.qtd}</span>
                  <button 
                    onClick={() => adicionar({id: item.id, nome: item.nome, preco_venda: item.preco, quantidade: item.estoque, categoria: item.tipo})}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button 
                  onClick={() => setCarrinho(c => c.filter(x => x.id !== item.id))}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {!carrinho.length && (
              <div className="flex h-full flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                  <ShoppingCart className="h-8 w-8 opacity-20" />
                </div>
                <p className="text-sm font-medium">Nenhum item no carrinho</p>
              </div>
            )}
          </div>

          <div className="bg-muted/30 p-5 space-y-4">
             <div className="space-y-1.5">
               <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Observações</Label>
               <Input 
                 value={observacoes}
                 onChange={e => setObservacoes(e.target.value)}
                 className="h-10 rounded-xl border-border/50 bg-background"
                 placeholder="Opcional..."
               />
             </div>

             <div className="space-y-1.5">
               <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cliente</Label>
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <button className="flex h-11 w-full items-center justify-between rounded-xl border border-border/50 bg-background px-4 text-sm font-medium transition-colors hover:bg-muted/50">
                     <span className="flex items-center gap-2">
                       <User className="h-4 w-4 text-muted-foreground" />
                       {selectedCliente}
                     </span>
                     <ChevronDown className="h-4 w-4 text-muted-foreground" />
                   </button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent
                   align="end"
                   className="w-[min(360px,calc(100vw-2rem))] rounded-xl"
                 >
                   <DropdownMenuItem onClick={() => setClienteId(null)}>Consumidor Final</DropdownMenuItem>
                   {clientes.map(c => (
                     <DropdownMenuItem key={c.id} onClick={() => setClienteId(c.id)}>
                       {c.nome}
                     </DropdownMenuItem>
                   ))}
                 </DropdownMenuContent>
               </DropdownMenu>
             </div>

             <div className="flex items-center justify-between pt-2">
               <span className="text-sm font-medium text-muted-foreground">Total</span>
               <span className="text-2xl font-black text-primary">{brl(total)}</span>
             </div>

             <Button 
               onClick={() => finalizar.mutate()}
               disabled={finalizar.isPending || !carrinho.length}
               className="h-12 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20"
             >
               Finalizar venda
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}