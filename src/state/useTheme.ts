import { useCallback, useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "nw.theme";
const LIGHT_BG = "#f6f4f1";
const DARK_BG = "#0b0c0b";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  return "system";
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePref): ResolvedTheme {
  if (pref === "system") return systemDark() ? "dark" : "light";
  return pref;
}

function apply(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = resolved === "dark" ? DARK_BG : LIGHT_BG;
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);

  useEffect(() => {
    apply(resolve(pref));
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* storage unavailable */
    }
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(resolve("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const cycle = useCallback(() => {
    setPref((p) => (p === "system" ? "light" : p === "light" ? "dark" : "system"));
  }, []);

  return { pref, cycle, setPref };
}
