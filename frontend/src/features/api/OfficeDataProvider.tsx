"use client";

import { createContext, useContext } from "react";
import { useOfficeData } from "./useOfficeData";

type OfficeDataContextValue = ReturnType<typeof useOfficeData>;

const OfficeDataContext = createContext<OfficeDataContextValue | null>(null);

export function OfficeDataProvider({ children }: { children: React.ReactNode }) {
  const value = useOfficeData();
  return <OfficeDataContext.Provider value={value}>{children}</OfficeDataContext.Provider>;
}

export function useOfficeDataContext() {
  const value = useContext(OfficeDataContext);
  if (!value) {
    throw new Error("useOfficeDataContext must be used inside OfficeDataProvider");
  }
  return value;
}
