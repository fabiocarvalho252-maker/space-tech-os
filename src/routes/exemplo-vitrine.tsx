import { createFileRoute } from "@tanstack/react-router";
import { PaginaCampanha } from "@/components/PaginaCampanha";

export const Route = createFileRoute("/exemplo-vitrine")({
  head: () => ({
    meta: [
      { title: "Exemplo de vitrine — SpaceTech" },
      {
        name: "description",
        content: "Veja como fica a vitrine online da sua assistência no SpaceTech OS.",
      },
    ],
  }),
  component: ExemploVitrine,
});

// Itens fictícios: esta página é só um exemplo visual, sem dados de loja real.
const ITENS_EXEMPLO = [
  { nome: "Película 3D (exemplo)", categoria: "Acessórios" },
  { nome: "Tela de reposição (exemplo)", categoria: "Peças" },
  { nome: "Troca de bateria (exemplo)", categoria: "Serviços" },
  { nome: "Carregador USB-C (exemplo)", categoria: "Acessórios" },
];

function ExemploVitrine() {
  return (
    <PaginaCampanha
      titulo="Sua vitrine online"
      subtitulo="Os produtos e serviços liberados aparecem para o cliente em um link próprio, com pedido pelo WhatsApp."
      ilustrativo
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {ITENS_EXEMPLO.map((item) => (
          <li key={item.nome} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase text-muted-foreground">{item.categoria}</p>
            <p className="mt-1 font-semibold">{item.nome}</p>
          </li>
        ))}
      </ul>
    </PaginaCampanha>
  );
}
