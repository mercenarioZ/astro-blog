import { nextTick, onMounted, onUnmounted, ref } from "vue";

export type Theme = "light" | "dark";

const themes = ["light", "dark"] as const;
const fallbackClass = "theme-transitioning";
const viewTransitionClass = "theme-view-transition";
const fallbackDuration = 420;
const revealDuration = 760;
const revealEasing = "cubic-bezier(0.76, 0, 0.24, 1)";

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
  let reducedMotionQuery: MediaQueryList | undefined;
  let fallbackTimer: number | undefined;
  let activeTransition: ViewTransition | undefined;
  let transitionSequence = 0;

  const prefersReducedMotion = () =>
    reducedMotionQuery?.matches ??
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  const clearFallback = () => {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = undefined;
    document.documentElement.classList.remove(fallbackClass);
  };

  const startFallback = () => {
    clearFallback();
    document.documentElement.classList.add(fallbackClass);
    fallbackTimer = window.setTimeout(
      clearFallback,
      prefersReducedMotion() ? 50 : fallbackDuration,
    );
  };

  const clearViewTransition = () => {
    document.documentElement.classList.remove(viewTransitionClass);
  };

  const startViewTransition = (nextTheme: Theme, event: MouseEvent) => {
    if (
      typeof document.startViewTransition !== "function" ||
      prefersReducedMotion()
    ) {
      return false;
    }

    const target = event.currentTarget;
    const rect =
      target instanceof HTMLElement ? target.getBoundingClientRect() : null;
    const x = rect ? rect.left + rect.width / 2 : innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : 0;
    const radius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    );
    const root = document.documentElement;
    const sequence = ++transitionSequence;

    activeTransition?.skipTransition();
    activeTransition = undefined;
    clearFallback();
    root.classList.add(viewTransitionClass);

    let transition: ViewTransition;

    try {
      transition = document.startViewTransition(async () => {
        applyTheme(nextTheme);
        await nextTick();
      });
    } catch {
      clearViewTransition();
      return false;
    }

    activeTransition = transition;

    void transition.ready
      .then(() => {
        if (
          sequence !== transitionSequence ||
          transition !== activeTransition
        ) {
          return;
        }

        const origin = `${x}px ${y}px`;

        root.animate(
          {
            clipPath: [
              `circle(0px at ${origin})`,
              `circle(${Math.ceil(radius)}px at ${origin})`,
            ],
          },
          {
            duration: revealDuration,
            easing: revealEasing,
            fill: "both",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => undefined);

    const finish = () => {
      if (
        sequence === transitionSequence &&
        transition === activeTransition
      ) {
        activeTransition = undefined;
        clearViewTransition();
      }
    };

    void transition.finished.then(finish, finish);
    return true;
  };

  const syncTheme = () => applyTheme(getPreferredTheme(), false);
  const handleSystemTheme = () => !readStoredTheme() && syncTheme();
  const handleStorage = (event: StorageEvent) =>
    event.key === "theme" && syncTheme();

  const selectTheme = (nextTheme: Theme, event: MouseEvent) => {
    if (theme.value === nextTheme) return;
    if (startViewTransition(nextTheme, event)) return;

    startFallback();
    applyTheme(nextTheme);
  };

  onMounted(() => {
    systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

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

    transitionSequence += 1;
    activeTransition?.skipTransition();
    activeTransition = undefined;
    clearFallback();
    clearViewTransition();
  });

  return { themes, theme, isReady, selectTheme };
};
