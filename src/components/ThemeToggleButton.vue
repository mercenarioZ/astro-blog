<script setup lang="ts">
import { Moon, Sun } from "@lucide/vue";
import { createThemeToggle } from "../composables/themeToggle";

const { themes, theme, isReady, selectTheme } = createThemeToggle();
const icons = { light: Sun, dark: Moon };
const labels = { light: "Use light theme", dark: "Use dark theme" };
</script>

<template>
  <div
    v-if="isReady"
    class="theme-toggle-shell"
    :class="`theme-toggle-${theme}`"
    role="group"
    aria-label="Color theme"
  >
    <span class="theme-toggle-thumb" aria-hidden="true"></span>

    <button
      v-for="item in themes"
      :key="item"
      type="button"
      class="theme-toggle-button"
      :class="[
        `theme-toggle-button-${item}`,
        { 'theme-toggle-button-active': theme === item },
      ]"
      :aria-label="labels[item]"
      :aria-pressed="theme === item"
      @click="selectTheme(item)"
    >
      <component
        :is="icons[item]"
        class="theme-toggle-icon"
        aria-hidden="true"
      />
    </button>
  </div>

  <div v-else class="theme-toggle-placeholder" aria-hidden="true"></div>
</template>

<style scoped src="../../styles/theme-toggle.css"></style>
