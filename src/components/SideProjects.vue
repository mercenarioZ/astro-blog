<script setup lang="ts">
interface SideProject {
  title: string;
  status: string;
  links: Array<{ label: string; href: string }>;
  bodyHtml: string;
  stack: string[];
}

defineProps<{ projects: SideProject[] }>();
</script>

<template>
  <section class="about-section about-projects">
    <h2>Side projects</h2>

    <div class="about-projects__list">
      <article
        v-for="project in projects"
        :key="project.title"
        class="about-project"
      >
        <div class="about-project__heading">
          <h3>{{ project.title }}</h3>
          <span>{{ project.status }}</span>
        </div>

        <div class="about-project__body" v-html="project.bodyHtml"></div>

        <p class="about-project__stack">{{ project.stack.join(" · ") }}</p>

        <nav v-if="project.links.length" aria-label="Project links">
          <a
            v-for="link in project.links"
            :key="link.href"
            :href="link.href"
          >
            {{ link.label }} ↗
          </a>
        </nav>
      </article>
    </div>
  </section>
</template>
