import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const sideProjects = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/side-projects",
  }),
  schema: z.object({
    title: z.string(),
    status: z.string(),
    links: z
      .array(
        z.object({
          label: z.string(),
          href: z.string(),
        }),
      )
      .optional(),
    stack: z.array(z.string()),
    order: z.number(),
  }),
});

export const collections = {
  sideProjects,
};
