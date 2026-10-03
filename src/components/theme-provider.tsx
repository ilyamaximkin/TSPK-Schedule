"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps the app with next-themes. Reads/writes the theme in localStorage
 * under the "tspk-theme" key, applies it as a class on <html> ("light" /
 * "dark" / "system").
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="tspk-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
