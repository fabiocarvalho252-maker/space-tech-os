import { createFileRoute } from "@tanstack/react-router";
import { PaginaCampanha } from "@/components/PaginaCampanha";

export const Route = createFileRoute("/mei")({
  head: () => ({
    meta: [
      { title: "Relatório MEI — SpaceTech" },
      {
        name: "description",
        content:
          "Receita mês a mês separada em comércio e serviços, para a declaração anual do MEI.",
      },
    ],
  }),
  component: PaginaMei,
});

function PaginaMei() {
  return (
    <PaginaCampanha
      titulo="Relatório MEI"
      subtitulo="Sua receita bruta mês a mês, separada em comércio e serviços, pronta para a declaração anual do MEI."
    >
      <ul className="space-y-3 text-sm">
        <li className="rounded-2xl border border-border bg-card p-5">
          <strong>Receita por mês</strong>
          <p className="mt-1 text-muted-foreground">
            Vendas e serviços somados mês a mês, sem planilha paralela.
          </p>
        </li>
        <li className="rounded-2xl border border-border bg-card p-5">
          <strong>Comércio e serviços separados</strong>
          <p className="mt-1 text-muted-foreground">
            Peças e produtos de um lado, mão de obra do outro.
          </p>
        </li>
      </ul>
    </PaginaCampanha>
  );
}
