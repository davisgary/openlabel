"use client";

import { createContext, useContext, useState, useEffect } from "react";

type ThemeType = "light" | "dark" | "auto";
interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const initScript = `
  (function() {
    const savedTheme = localStorage.getItem("theme") || "auto";
    const isDark = savedTheme === "dark" || (savedTheme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  })();
`;

export function Theme({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>(() => {
    if (typeof window === "undefined") return "auto";
    return (localStorage.getItem("theme") as ThemeType) || "auto";
  });

  useEffect(() => {
    const html = document.documentElement;
    const isDark = theme === "dark" || (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) html.classList.add("dark");
    else html.classList.remove("dark");

    localStorage.setItem("theme", theme);

    if (theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) html.classList.add("dark");
        else html.classList.remove("dark");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: initScript }} />
      <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
    </>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a Theme provider");
  return context;
}