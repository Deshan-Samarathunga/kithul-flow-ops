import { useEffect, useState } from "react";

export function usePersistentTab(key: string, defaultValue: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      if (typeof window === "undefined") return defaultValue;
      const saved = window.localStorage.getItem(key);
      return typeof saved === "string" && saved.length > 0 ? saved : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore write errors
    }
  }, [key, value]);

  return [value, setValue] as const;
}
