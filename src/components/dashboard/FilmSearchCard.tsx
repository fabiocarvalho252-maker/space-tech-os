import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

// Reuses the real película search on /ferramentas (peliculas_catalogo table
// + buscarModelosCompativeis) instead of re-implementing it here — this card
// is just a fast entry point that hands the typed term to that page via a
// search param.
export function FilmSearchCard() {
  const navigate = useNavigate();
  const [termo, setTermo] = useState("");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/ferramentas", search: termo.trim() ? { busca: termo.trim() } : {} });
  }

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl bg-[#065F46] p-5 text-white shadow-soft">
      <div>
        <h3 className="text-base font-bold">Buscador de Películas</h3>
        <p className="mt-1 text-sm text-white/75">
          Encontre rapidamente a película compatível com o aparelho.
        </p>
      </div>
      <form onSubmit={buscar} className="mt-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Marca ou modelo do aparelho..."
            aria-label="Buscar película compatível"
            className="h-11 w-full rounded-full border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/50 outline-none focus:border-white/40 focus:ring-2 focus:ring-white/20"
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-white px-5 text-sm font-bold text-[#065F46] transition-opacity hover:opacity-90"
        >
          Buscar
        </button>
      </form>
    </div>
  );
}
