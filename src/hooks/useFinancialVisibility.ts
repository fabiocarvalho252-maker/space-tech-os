import { createContext, useContext } from "react";

export type FinancialVisibilityContextValue = {
  isFinancialValuesVisible: boolean;
  toggleFinancialValues: () => void;
  showFinancialValues: () => void;
  hideFinancialValues: () => void;
  formatFinancialValue: (value: number | string | null | undefined) => string;
};

export const FinancialVisibilityContext = createContext<FinancialVisibilityContextValue | null>(
  null,
);

export function useFinancialVisibility() {
  const ctx = useContext(FinancialVisibilityContext);
  if (!ctx) {
    throw new Error("useFinancialVisibility deve ser usado dentro de FinancialVisibilityProvider");
  }
  return ctx;
}
