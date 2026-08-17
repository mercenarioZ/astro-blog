import { onMounted, onUnmounted, ref } from "vue";

export type Theme = "light" | "dark";

const themes = ["light", "dark"] as const;

const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dark";

const readStoredTheme = () => {
  try {
    const storedTheme = localStorage.getItem("theme");
    return isTheme(storedTheme) ? storedTheme : undefined;
  } catch {
    return undefined;
  }
};

const getPreferredTheme = (): Theme =>
  readStoredTheme() ??
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");

export const createThemeToggle = () => {
  const theme = ref<Theme>("light");
  const isReady = ref(false);

  let systemThemeQuery: MediaQueryList | undefined;

  const applyTheme = (nextTheme: Theme, persist = true) => {
    theme.value = nextTheme;
    document.documentElement.classList.toggle(
      "dark",
      nextTheme === "dark",
    );
    document.documentElement.style.colorScheme = nextTheme;

    if (!persist) return;

    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // Theme changes still work when storage is unavailable.
    }
  };

  const syncTheme = () => applyTheme(getPreferredTheme(), false);
  const handleSystemTheme = () => !readStoredTheme() && syncTheme();
  const handleStorage = (event: StorageEvent) =>
    event.key === "theme" && syncTheme();

  const selectTheme = (nextTheme: Theme) => {
    if (theme.value !== nextTheme) applyTheme(nextTheme);
  };

  onMounted(() => {
    systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

    syncTheme();
    isReady.value = true;

    systemThemeQuery.addEventListener("change", handleSystemTheme);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("astro:after-swap", syncTheme);
  });

  onUnmounted(() => {
    systemThemeQuery?.removeEventListener("change", handleSystemTheme);
    window.removeEventListener("storage", handleStorage);
    document.removeEventListener("astro:after-swap", syncTheme);
  });

  return { themes, theme, isReady, selectTheme };
};
