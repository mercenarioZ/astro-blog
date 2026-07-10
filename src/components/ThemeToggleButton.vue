<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";
import { onMounted, onUnmounted, ref } from "vue";

type Theme = "light" | "dark";

interface ApplyThemeOptions {
  animate?: boolean;
  persist?: boolean;
}

const themes: Theme[] = ["light", "dark"];
const themeTransitionClass = "theme-transitioning";
const themeTransitionDuration = 520;

const theme = ref<Theme>("light");
const isReady = ref(false);

let preferredThemeQuery: MediaQueryList | undefined;
let transitionTimeout: number | undefined;

const isTheme = (value: string | null): value is Theme =>
  value === "light" || value === "dark";

const getStoredTheme = () => {
  try {
    const storedTheme = localStorage.getItem("theme");
    return isTheme(storedTheme) ? storedTheme : undefined;
  } catch {
    return undefined;
  }
};

const getPreferredTheme = (): Theme => {
  const storedTheme = getStoredTheme();

  if (storedTheme) return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const startThemeTransition = () => {
  const root = document.documentElement;

  window.clearTimeout(transitionTimeout);
  root.classList.remove(themeTransitionClass);
  void root.offsetWidth;
  root.classList.add(themeTransitionClass);

  transitionTimeout = window.setTimeout(() => {
    root.classList.remove(themeTransitionClass);
    transitionTimeout = undefined;
  }, themeTransitionDuration);
};

const applyTheme = (
  nextTheme: Theme,
  { animate = false, persist = true }: ApplyThemeOptions = {},
) => {
  if (animate && theme.value !== nextTheme) startThemeTransition();

  theme.value = nextTheme;

  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  document.documentElement.style.colorScheme = nextTheme;

  if (!persist) return;

  try {
    localStorage.setItem("theme", nextTheme);
  } catch {
    // The visible theme should still update if storage is unavailable.
  }
};

const syncTheme = () => {
  applyTheme(getPreferredTheme(), { persist: false });
};

const handlePreferredThemeChange = () => {
  if (!getStoredTheme()) syncTheme();
};

const handleStorage = (event: StorageEvent) => {
  if (event.key === "theme") syncTheme();
};

const selectTheme = (nextTheme: Theme) => {
  applyTheme(nextTheme, { animate: true });
};

onMounted(() => {
  preferredThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  syncTheme();
  isReady.value = true;

  preferredThemeQuery.addEventListener("change", handlePreferredThemeChange);
  window.addEventListener("storage", handleStorage);
  document.addEventListener("astro:after-swap", syncTheme);
});

onUnmounted(() => {
  preferredThemeQuery?.removeEventListener(
    "change",
    handlePreferredThemeChange,
  );

  window.removeEventListener("storage", handleStorage);
  document.removeEventListener("astro:after-swap", syncTheme);

  window.clearTimeout(transitionTimeout);
  document.documentElement.classList.remove(themeTransitionClass);
});
</script>

<template>
  <div
    v-if="isReady"
    class="relative isolate grid h-9 w-[72px] shrink-0 grid-cols-2 items-center overflow-hidden rounded-full border border-orange-200/80 bg-gradient-to-r from-orange-100 via-white to-sky-100 p-0.5 text-zinc-700 shadow-sm shadow-orange-900/10 transition-colors duration-300 dark:border-zinc-700 dark:from-zinc-800 dark:via-zinc-900 dark:to-indigo-950 dark:text-zinc-300 dark:shadow-black/30"
    role="group"
    aria-label="Color theme"
  >
    <span
      class="pointer-events-none absolute inset-y-0.5 left-0.5 z-0 w-[34px] rounded-full bg-white shadow-md shadow-orange-900/15 ring-1 ring-orange-100 transition-transform duration-300 ease-out dark:bg-zinc-950 dark:shadow-black/40 dark:ring-zinc-700"
      :class="theme === 'dark' ? 'translate-x-[34px]' : 'translate-x-0'"
      aria-hidden="true"
    ></span>

    <button
      v-for="item in themes"
      :key="item"
      type="button"
      class="relative z-10 grid h-8 w-[34px] place-items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      :class="
        theme === item
          ? item === 'light'
            ? 'text-orange-600'
            : 'text-sky-300'
          : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-50'
      "
      :aria-label="item === 'light' ? 'Use light theme' : 'Use dark theme'"
      :aria-pressed="theme === item"
      @click="selectTheme(item)"
    >
      <Sun
        v-if="item === 'light'"
        class="theme-toggle-icon theme-toggle-icon-sun size-4"
        :class="
          theme === item
            ? 'theme-toggle-icon-active'
            : 'theme-toggle-icon-inactive'
        "
        aria-hidden="true"
      />

      <Moon
        v-else
        class="theme-toggle-icon theme-toggle-icon-moon size-4"
        :class="
          theme === item
            ? 'theme-toggle-icon-active'
            : 'theme-toggle-icon-inactive'
        "
        aria-hidden="true"
      />
    </button>
  </div>

  <div
    v-else
    class="h-9 w-[72px] shrink-0"
    aria-hidden="true"
  ></div>
</template>
