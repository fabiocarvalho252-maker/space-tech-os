import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Visual standardization only — keeps the same plain-number semantics
// (value/onChange as numbers) already used by every money field in the app,
// just adds the "R$" prefix consistently instead of leaving it to each
// screen's own markup.
export function MoneyInput({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        type="number"
        step="0.01"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn("pl-9", className)}
        {...props}
      />
    </div>
  );
}
