import { createFileRoute } from "@tanstack/react-router";
import { PaginaCampanha } from "@/components/PaginaCampanha";

export const Route = createFileRoute("/como-funciona")({
  head: () => ({
    meta: [
      { title: "Como funciona — SpaceTech" },
      {
        name: "description",
        content: "Veja como abrir uma OS e acompanhar o conserto no SpaceTech OS.",
      },
    ],
  }),
  component: ComoFunciona,
});

const PASSOS = [
  {
    numero: "1",
    titulo: "Cadastre a assistência",
    texto: "Nome, WhatsApp, e-mail e senha. Em poucos minutos a conta está pronta, sem cartão.",
  },
  {
    numero: "2",
    titulo: "Abra a OS com fotos e checklist",
    texto:
      "Cliente, aparelho e defeito. Tire as fotos de entrada e marque o checklist antes do conserto.",
  },
  {
    numero: "3",
    titulo: "O cliente acompanha pelo link",
    texto:
      "Imprima a etiqueta com QR Code. O cliente vê o andamento e aprova o orçamento sem ligar.",
  },
];

function ComoFunciona() {
  return (
    <PaginaCampanha
      titulo="Como funciona"
      subtitulo="Três passos para sair do caderno e acompanhar cada OS sem ligação de cliente."
    >
      <ol className="grid gap-4 sm:grid-cols-3">
        {PASSOS.map((passo) => (
          <li key={passo.numero} className="rounded-2xl border border-border bg-card p-5">
            <span className="text-3xl font-extrabold text-primary">{passo.numero}</span>
            <h2 className="mt-2 font-bold">{passo.titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{passo.texto}</p>
          </li>
        ))}
      </ol>
    </PaginaCampanha>
  );
}
