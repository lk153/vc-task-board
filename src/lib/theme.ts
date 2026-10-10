import { COOKIES } from "@/config/board";

export type Theme = "light" | "dark";

/**
 * Runs in <head> before first paint: applies the saved theme from the cookie.
 * Without a cookie the CSS follows the system setting (color-scheme: light dark).
 */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${COOKIES.theme}=(light|dark)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;

export function readThemeCookie(): Theme | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIES.theme}=(light|dark)`));
  return (match?.[1] as Theme | undefined) ?? null;
}

/** The theme currently on screen (saved choice, else the system setting). */
export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.cookie = `${COOKIES.theme}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}
