import { Eye, EyeOff } from "lucide-react";
import { useFinancialVisibility } from "@/hooks/useFinancialVisibility";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FinancialVisibilityToggle() {
  const { isFinancialValuesVisible, toggleFinancialValues } = useFinancialVisibility();
  const label = isFinancialValuesVisible ? "Ocultar valores" : "Mostrar valores";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={toggleFinancialValues}
            aria-label={label}
            aria-pressed={!isFinancialValuesVisible}
          >
            {isFinancialValuesVisible ? (
              <Eye className="h-[1.2rem] w-[1.2rem]" />
            ) : (
              <EyeOff className="h-[1.2rem] w-[1.2rem]" />
            )}
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
