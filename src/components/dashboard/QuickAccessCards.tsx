import { Link } from "@tanstack/react-router";
import { ATALHOS } from "@/lib/atalhos";

// Visual counterpart to AppShell's global F1-F8 keydown listener — same
// ATALHOS list drives both, so clicking a card and pressing its key do the
// exact same navigation.
export function QuickAccessCards() {
  return (
    // Celular: 4 por linha, só ícone + nome (eram 2 por linha, 4 linhas de
    // cartões grandes antes de qualquer número do painel).
    <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
      {ATALHOS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className={`group relative flex flex-col items-center overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradiente} p-2.5 text-center text-white shadow-soft transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] sm:block sm:p-4 sm:text-left`}
        >
          <span className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/15 transition-transform duration-300 group-hover:scale-110" />
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm sm:h-9 sm:w-9">
            <a.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="relative mt-1.5 w-full truncate text-[11px] font-bold sm:mt-3 sm:text-sm">
            {a.label}
          </p>
          <p className="relative hidden text-[11px] font-medium text-white/80 sm:block">
            {a.tecla}
          </p>
        </Link>
      ))}
    </div>
  );
}
