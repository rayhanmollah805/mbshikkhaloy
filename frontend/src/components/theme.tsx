"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "theme";

/** Dark mode for the signed-in app. The class sits on <html> only while this hook is mounted. */
export function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let on = false;
    try {
      on = localStorage.getItem(KEY) === "dark";
    } catch {
      /* storage blocked */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(on);
    return () => document.documentElement.classList.remove("dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const toggle = useCallback(() => {
    setDark((d) => {
      try {
        localStorage.setItem(KEY, d ? "light" : "dark");
      } catch {
        /* storage blocked */
      }
      return !d;
    });
  }, []);
  return { dark, toggle };
}
