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
    <span class="theme-toggle-atmosphere" aria-hidden="true">
      <span class="theme-toggle-haze"></span>
      <span class="theme-toggle-star theme-toggle-star-one"></span>
      <span class="theme-toggle-star theme-toggle-star-two"></span>
      <span class="theme-toggle-star theme-toggle-star-three"></span>
    </span>

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
      @click="selectTheme(item, $event)"
    >
      <component
        :is="icons[item]"
        class="theme-toggle-icon"
        :class="[
          `theme-toggle-icon-${item}`,
          theme === item
            ? 'theme-toggle-icon-active'
            : 'theme-toggle-icon-inactive',
        ]"
        aria-hidden="true"
      />
    </button>
  </div>

  <div v-else class="theme-toggle-placeholder" aria-hidden="true"></div>
</template>

<style scoped src="../../styles/theme-toggle.css"></style>
