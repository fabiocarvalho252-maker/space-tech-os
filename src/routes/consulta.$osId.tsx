import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataBR, statusLabel } from "@/lib/format";
import { LogoMark, LogoWord } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, Wrench, AlertCircle, Search, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/consulta/$osId")({
  component: ConsultaPublica,
});

function ConsultaPublica() {
  const { osId } = Route.useParams();

  const { data: os, isLoading, error } = useQuery({
    queryKey: ["os-publica", osId],
    queryFn: async () => {
      // Tentar buscar por UUID (id) ou por número sequencial (numero)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(osId);
      
      let query = supabase
        .from("ordens_servico")
        .select("*, clientes(nome), profiles(loja, telefone_contato)");

      if (isUuid) {
        query = query.eq("id", osId);
      } else {
        const num = parseInt(osId);
        if (isNaN(num)) throw new Error("ID inválido");
        query = query.eq("numero", num);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <LogoMark className="h-12 w-12 opacity-50" />
          <p className="text-sm text-muted-foreground font-medium">Buscando informações da sua OS...</p>
        </div>
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-muted/30">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold">Ordem de Serviço não encontrada</h1>
        <p className="text-muted-foreground text-center mt-2 max-w-xs">
          Verifique o link ou o QR Code e tente novamente.
        </p>
        <a href="/" className="mt-6 text-primary font-medium hover:underline">Voltar ao início</a>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'recebido': return <Clock className="h-5 w-5 text-blue-500" />;
      case 'em_analise': return <Search className="h-5 w-5 text-amber-500" />;
      case 'orcamento': return <AlertCircle className="h-5 w-5 text-purple-500" />;
      case 'aprovado': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'em_reparo': return <Wrench className="h-5 w-5 text-indigo-500" />;
      case 'pronto': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="bg-background border-b border-border px-4 py-6 mb-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8 text-primary" />
            <LogoWord className="text-lg" />
          </div>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            Área do Cliente
          </Badge>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4">
        <Card className="border-none shadow-soft overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 border-b border-primary/10 py-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-primary uppercase tracking-tighter mb-1">Ordem de Serviço</p>
                <CardTitle className="text-3xl font-black">#{os.numero}</CardTitle>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-medium mb-1">Status Atual</p>
                <div className="flex items-center gap-2 justify-end">
                  {getStatusIcon(os.status)}
                  <span className="font-bold text-sm">{statusLabel(os.status)}</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            <section className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Aparelho</Label>
                <p className="font-bold text-lg mt-0.5">{os.aparelho}</p>
                <p className="text-sm text-muted-foreground">{os.marca} {os.modelo}</p>
              </div>
              <div className="text-right">
                <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Data de Entrada</Label>
                <p className="font-bold text-lg mt-0.5">{dataBR(os.created_at)}</p>
              </div>
            </section>

            <Separator className="bg-border/50" />

            <section className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Detalhes do Serviço
              </h3>
              <div className="bg-muted/40 rounded-xl p-4 border border-border/50 space-y-4">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Defeito Relatado</Label>
                  <p className="text-sm mt-1">{os.defeito || "Nenhuma descrição fornecida."}</p>
                </div>
                {os.diagnostico && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Diagnóstico Técnico</Label>
                    <p className="text-sm mt-1">{os.diagnostico}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" /> Resumo Financeiro
                </h3>
              </div>
              <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl border border-primary/10">
                <span className="text-sm font-medium">Valor Total</span>
                <span className="text-xl font-black text-primary">{brl(os.valor)}</span>
              </div>
            </section>

            <footer className="pt-6 text-center border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-4">Em caso de dúvidas, entre em contato com a assistência:</p>
              <div className="flex flex-col items-center gap-1">
                <p className="font-bold text-sm">{(os as any).profiles?.loja || "SpaceTech"}</p>
                { (os as any).profiles?.telefone_contato && (
                  <p className="text-xs text-muted-foreground">WhatsApp: {(os as any).profiles.telefone_contato}</p>
                )}
              </div>
            </footer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
