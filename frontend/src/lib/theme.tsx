/**
 * Global dark/light theme context for Momentum.
 *
 * Persists preference to localStorage under "momentum-theme".
 * Applies by toggling the "dark" class on <html> (the shell uses class="dark").
 * Light mode is the absence of "dark" on the html element.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const STORAGE_KEY = "momentum-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // On mount: read stored preference and apply it.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const resolved: Theme =
        stored === "light" || stored === "dark" ? stored : "dark";
      setTheme(resolved);
      applyTheme(resolved);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/** Apply theme by toggling "dark" class on the document root. */
function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.remove("dark");
    html.classList.add("light");
  }
}
