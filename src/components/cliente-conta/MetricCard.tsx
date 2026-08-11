import type { LucideIcon } from "lucide-react";

export function MetricCard({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm ${
        onClick ? "transition hover:border-[#2563eb]/40 hover:shadow-md" : ""
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] text-[#2563eb]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-2xl font-extrabold text-slate-900">{value}</span>
        <span className="block text-sm text-slate-500">{label}</span>
      </span>
    </Comp>
  );
}
