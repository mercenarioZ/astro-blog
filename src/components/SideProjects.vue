<script setup lang="ts">
import { computed } from "vue";

interface SideProject {
  title: string;
  status: string;
  links: Array<{
    label: string;
    href: string;
  }>;
  bodyHtml: string;
  stack: string[];
}

const props = defineProps<{
  projects: SideProject[];
}>();

const projectCountLabel = computed(
  () => `${props.projects.length} active threads`,
);
</script>

<template>
  <section class="about-stack-section mt-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="about-section-kicker">Side Projects</p>
        <h2 class="mt-4 text-2xl font-black leading-tight">
          Small apps and experiments
        </h2>
      </div>
      <span
        class="text-xs font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400"
      >
        {{ projectCountLabel }}
      </span>
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-3">
      <article
        v-for="project in projects"
        :key="project.title"
        class="about-project-card"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-lg font-black leading-tight">
            {{ project.title }}
          </h3>
          <span class="about-project-status">{{ project.status }}</span>
        </div>

        <div
          class="about-project-body"
          v-html="project.bodyHtml"
        ></div>
        <div
          v-if="project.links.length > 0"
          class="about-project-links"
        >
          <a
            v-for="link in project.links"
            :key="link.href"
            :href="link.href"
            class="about-project-link"
          >
            {{ link.label }}
          </a>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <span
            v-for="item in project.stack"
            :key="item"
            class="about-project-chip"
          >
            {{ item }}
          </span>
        </div>
      </article>
    </div>
  </section>
</template>
