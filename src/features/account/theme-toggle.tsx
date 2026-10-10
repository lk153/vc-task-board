"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect } from "react";
import { IconButton } from "@/components/ui/button";
import { applyTheme, currentTheme, readThemeCookie } from "@/lib/theme";

/** Light/dark toggle. Starts from the system setting; the choice is kept in a cookie. */
export function ThemeToggle() {
  // In development React's Strict Mode remount clears the attribute set by the
  // inline <head> script; re-apply it before paint. No-op in production.
  useLayoutEffect(() => {
    const saved = readThemeCookie();
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  }, []);

  return (
    <IconButton
      label="Toggle dark mode"
      variant="outline"
      onClick={() => applyTheme(currentTheme() === "dark" ? "light" : "dark")}
    >
      <Moon className="theme-light-only" size={16} strokeWidth={1.9} />
      <Sun className="theme-dark-only" size={16} strokeWidth={1.9} />
    </IconButton>
  );
}
