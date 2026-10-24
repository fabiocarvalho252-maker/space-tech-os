import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatFinancialValue } from "@/lib/format";
import {
  FinancialVisibilityContext,
  type FinancialVisibilityContextValue,
} from "@/hooks/useFinancialVisibility";

const STORAGE_KEY = "space-tech-financial-values-visible";

function lerPreferenciaInicial(): boolean {
  if (typeof window === "undefined") return true;
  const salvo = window.localStorage.getItem(STORAGE_KEY);
  return salvo === null ? true : salvo === "true";
}

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
    [
      isFinancialValuesVisible,
      toggleFinancialValues,
      showFinancialValues,
      hideFinancialValues,
      format,
    ],
  );

  return (
    <FinancialVisibilityContext.Provider value={value}>
      {children}
    </FinancialVisibilityContext.Provider>
  );
}
