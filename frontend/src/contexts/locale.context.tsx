"use client";

import React, { createContext, useState, useEffect, useContext } from "react";
import { Locale, translations } from "@/locales/translations";

export interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.en) => string;
}

export const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const storedLocale = localStorage.getItem("store:locale") as Locale;
    if (storedLocale && (storedLocale === "en" || storedLocale === "vi")) {
      setLocaleState(storedLocale);
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("store:locale", newLocale);
  };

  const t = (key: keyof typeof translations.en): string => {
    const dict = translations[locale] || translations.en;
    return dict[key] || translations.en[key] || String(key);
  };

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        t
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
