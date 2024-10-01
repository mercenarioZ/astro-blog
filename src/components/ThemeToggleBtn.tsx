import React, { useEffect } from "react";
import { IoMoon, IoSunny } from "react-icons/io5";

const themes = ["light", "dark"];

export default function ThemeToggle() {
  const [isMounted, setIsMounted] = React.useState(false);

  const [theme, setTheme] = React.useState<string | undefined>(() => {
    if (import.meta.env.SSR) return undefined;

    if (typeof localStorage !== "undefined" && localStorage.getItem("theme")) {
      return localStorage.getItem("theme") || undefined;
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  });

  const toggleTheme = () => {
    const t = theme === "light" ? "dark" : "light";

    localStorage.setItem("theme", t);
    setTheme(t);
  };

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "light") {
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
    }
  }, [theme]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return isMounted ? (
    <div className="inline-flex items-center p-[1px] bg-orange-300 dark:bg-zinc-600 rounded-3xl">
      {themes.map((t) => {
        const checked = t === theme;

        return (
          <button
            key={t}
            onClick={toggleTheme}
            className={`${checked ? "bg-white text-black" : ""} p-2 rounded-3xl transition`}
          >
            {t === "light" ? <IoSunny /> : <IoMoon />}
          </button>
        );
      })}
    </div>
  ) : (
    <div />
  );
}
