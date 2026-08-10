import { Link } from "@tanstack/react-router";
import { ATALHOS } from "@/lib/atalhos";

// Visual counterpart to AppShell's global F1-F8 keydown listener — same
// ATALHOS list drives both, so clicking a card and pressing its key do the
// exact same navigation.
export function QuickAccessCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {ATALHOS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${a.gradiente} p-4 text-white shadow-soft transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]`}
        >
          <span className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/15 transition-transform duration-300 group-hover:scale-110" />
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <a.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="relative mt-3 text-sm font-bold">{a.label}</p>
          <p className="relative text-[11px] font-medium text-white/80">{a.tecla}</p>
        </Link>
      ))}
    </div>
  );
}
