import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FaturarOsModal } from "@/components/FaturarOsModal";

export const Route = createFileRoute("/_authenticated/ordens_/faturar/$osId")({
  head: () => ({
    meta: [{ title: "Faturar OS — SpaceTech" }],
  }),
  component: FaturarOsRota,
});

// Deep-link entry point (e.g. a bookmarked/shared URL) into the same
// "Faturar OS" modal used from the Ordens list — kept as a thin wrapper so
// there's a single implementation of the modal's logic instead of two
// diverging copies.
//
// The trailing underscore in the filename (ordens_.faturar.$osId.tsx) opts
// this route out of TanStack Router's automatic nesting under ordens.tsx:
// without it, this route becomes a *child* of /ordens, and since the Ordens
// component never renders an <Outlet/>, the child would silently never be
// shown — visiting /ordens/faturar/$osId would just render the Ordens list
// with this route's <head> tags applied to it.
function FaturarOsRota() {
  const { osId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <FaturarOsModal
      osId={osId}
      open
      onOpenChange={(v) => {
        if (!v) navigate({ to: "/ordens" });
      }}
    />
  );
}
