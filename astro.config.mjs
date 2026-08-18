// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";
import vue from "@astrojs/vue";
import mdx from "@astrojs/mdx";

import { remarkPostDefaults } from "./src/lib/remark-post-defaults.mjs";
// https://astro.build/config

export default defineConfig({
  site: "https://blog.mercenarioz.me",
  integrations: [mdx(), react(), vue()],
  markdown: {
    remarkPlugins: [remarkPostDefaults],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
