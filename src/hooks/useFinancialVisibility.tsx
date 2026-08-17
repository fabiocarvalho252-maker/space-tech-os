import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatFinancialValue } from "@/lib/format";

const STORAGE_KEY = "space-tech-financial-values-visible";

function lerPreferenciaInicial(): boolean {
  if (typeof window === "undefined") return true;
  const salvo = window.localStorage.getItem(STORAGE_KEY);
  return salvo === null ? true : salvo === "true";
}

type FinancialVisibilityContextValue = {
  isFinancialValuesVisible: boolean;
  toggleFinancialValues: () => void;
  showFinancialValues: () => void;
  hideFinancialValues: () => void;
  formatFinancialValue: (value: number | string | null | undefined) => string;
};

const FinancialVisibilityContext = createContext<FinancialVisibilityContextValue | null>(null);

export function FinancialVisibilityProvider({ children }: { children: ReactNode }) {
  const [isFinancialValuesVisible, setIsFinancialValuesVisible] = useState(lerPreferenciaInicial);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(isFinancialValuesVisible));
  }, [isFinancialValuesVisible]);

  const toggleFinancialValues = useCallback(() => setIsFinancialValuesVisible((v) => !v), []);
  const showFinancialValues = useCallback(() => setIsFinancialValuesVisible(true), []);
  const hideFinancialValues = useCallback(() => setIsFinancialValuesVisible(false), []);

  const format = useCallback(
    (value: number | string | null | undefined) =>
      formatFinancialValue(value, isFinancialValuesVisible),
    [isFinancialValuesVisible],
  );

  const value = useMemo<FinancialVisibilityContextValue>(
    () => ({
      isFinancialValuesVisible,
      toggleFinancialValues,
      showFinancialValues,
      hideFinancialValues,
      formatFinancialValue: format,
    }),
    [isFinancialValuesVisible, toggleFinancialValues, showFinancialValues, hideFinancialValues, format],
  );

  return (
    <FinancialVisibilityContext.Provider value={value}>
      {children}
    </FinancialVisibilityContext.Provider>
  );
}

export function useFinancialVisibility() {
  const ctx = useContext(FinancialVisibilityContext);
  if (!ctx) {
    throw new Error("useFinancialVisibility deve ser usado dentro de FinancialVisibilityProvider");
  }
  return ctx;
}
