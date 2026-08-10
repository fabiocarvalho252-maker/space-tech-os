import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "purple" | "neutral";

const TONES: Record<StatusTone, string> = {
  success: "bg-emerald-500/10 text-emerald-600",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-red-500/10 text-red-600",
  info: "bg-blue-500/10 text-blue-600",
  purple: "bg-violet-500/10 text-violet-600",
  neutral: "bg-secondary text-muted-foreground",
};

// Shared visual for every status pill in the app (OS, Notas Fiscais,
// Garantias, Vendas, ...). Never carries meaning through color alone — the
// label text is always rendered, and callers may pass an icon too.
export function StatusBadge({
  label,
  tone,
  icon: Icon,
  className,
}: {
  label: string;
  tone: StatusTone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  );
}
