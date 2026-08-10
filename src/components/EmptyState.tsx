import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 py-14 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function TableSkeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary/40" />
      ))}
    </div>
  );
}
