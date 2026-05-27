"use client";

import { LanguageProvider } from "@/context/language-context";
import { ThemeProvider } from "@/context/theme-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </ThemeProvider>
  );
}
