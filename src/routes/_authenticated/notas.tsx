import { createFileRoute } from "@tanstack/react-router";
import { FileCheck, Plus, Search, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais — SpaceTech" },
      { name: "description", content: "Gerenciamento e emissão de notas fiscais." },
    ],
  }),
  component: NotasFiscais,
});

function NotasFiscais() {
  return (
    <div>
      <PageHeader
        title="Notas Fiscais"
        subtitle="Gerencie e emita notas fiscais de vendas e serviços."
        action={
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Nova Nota
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por número, cliente ou CPF/CNPJ..." className="pl-10" />
        </div>
        <Button variant="outline">Filtros</Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <FileCheck className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold">Nenhuma nota fiscal emitida</h3>
          <p className="max-w-xs text-sm text-muted-foreground mt-1">
            Integre seu certificado digital para começar a emitir notas fiscais eletrônicas.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" /> Configurar Certificado
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Emitir Nota Avulsa
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h4 className="font-bold mb-2">Dica Pro</h4>
          <p className="text-sm text-muted-foreground">
            Você pode emitir notas fiscais diretamente da tela de <strong>Ordens de Serviço</strong> ou 
            do <strong>PDV</strong> após finalizar um atendimento ou venda.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h4 className="font-bold mb-2">Suporte Legal</h4>
          <p className="text-sm text-muted-foreground">
            As notas emitidas ficam armazenadas por 5 anos conforme a legislação vigente, 
            garantindo a segurança fiscal da sua assistência.
          </p>
        </div>
      </div>
    </div>
  );
}
