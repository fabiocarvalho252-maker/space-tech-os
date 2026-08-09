import { Badge } from '@/components/ui/badge';
import { STATUS_META } from '@/lib/service-order';
import { cn } from '@/lib/utils';
import type { ServiceOrderStatus } from '@prisma/client';

export function StatusBadge({ status, className }: { status: ServiceOrderStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <Badge variant="outline" className={cn(meta.badgeClass, className)}>
      {meta.label}
    </Badge>
  );
}
