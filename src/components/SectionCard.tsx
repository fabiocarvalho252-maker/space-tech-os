import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            {title && (
              <div>
                <h2 className="text-base font-bold leading-tight">{title}</h2>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
