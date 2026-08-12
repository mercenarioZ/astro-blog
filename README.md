# MercenarioZ's blog

A statically generated personal blog and portfolio built with Astro and
Tailwind CSS. Most of the site ships as HTML; Vue and React are used only where
a framework component is useful.

## Stack

- **Astro** provides routing, layouts, Markdown rendering, content collections,
  and the production build.
- **Tailwind CSS** provides utility classes and design tokens, with
  page-specific CSS for more involved visual treatments.
- **Vue** powers the interactive theme selector and server-renders the side
  project cards.
- **React** supports static icon rendering and the optional Mermaid diagram
  component.
- **MDX** is enabled for posts that need embedded components; the current posts
  are Markdown.

## Project structure

```text
.
├── public/                     # Unprocessed files with stable public URLs
│   └── favicon.svg
├── src/
│   ├── assets/                 # Images processed and bundled by Astro
│   │   ├── about/              # About-page imagery
│   │   ├── posts/<slug>/       # Post-owned cover images
│   │   └── social/             # Default social-card source image
│   ├── components/             # Reusable Astro, Vue, and React components
│   ├── composables/            # Client-side Vue behavior
│   ├── content/
│   │   └── side-projects/      # Markdown entries for the side-project grid
│   ├── layouts/                # Shared document and article shells
│   ├── lib/                    # Post loading and formatting helpers
│   ├── pages/                  # File-based routes
│   │   └── posts/              # Markdown and MDX blog posts
│   ├── constants/              # Structured About-page content
│   ├── config.ts               # Site-wide values
│   └── content.config.ts       # Astro content collection schemas
├── styles/                     # Global and route-specific styles
├── design.md                   # Shared visual-system rules
├── astro.config.mjs            # Astro integrations and Tailwind plugin
└── tailwind.config.mjs         # Tailwind configuration file
```

## How rendering works

Astro renders pages and framework components to static HTML during the build.
Framework components ship browser JavaScript only when they have a `client:*`
directive. Astro's client router and ordinary `<script>` tags provide the small
amount of browser behavior used elsewhere.

### Shared page shell

`src/layouts/MainLayout.astro` is the outer document for every route. It
combines:

- `MainHead.astro` for metadata, social cards, the Astro client router, global
  CSS, and the pre-render theme script.
- `Body.astro` for shared body colors, typography, and dark-mode classes.
- A page slot where each route supplies its header, content, and footer.

`BlogPost.astro` builds on `MainLayout.astro` and adds article metadata, the
cover image, publication date, title, description, and Markdown content slot.

### Homepage flow

```text
src/pages/posts/*.{md,mdx}
        ↓ import.meta.glob
src/lib/posts.ts
        ├──────→ src/lib/images.ts
        ↓
src/pages/index.astro
        ↓
src/components/PostCard.astro
```

`src/lib/posts.ts` eagerly loads post modules with `import.meta.glob`, sorts
them newest-first, resolves their hero images, normalizes tags, and formats
dates. The homepage renders every post as a numbered archive row through
`PostCard.astro`.

### Blog post flow

Each Markdown or MDX file in `src/pages/posts/` becomes a route such as
`src/pages/posts/dino-cli.md` → `/posts/dino-cli/`.

Posts use frontmatter to provide the homepage and article metadata. These fields
are expected by the loaders and layouts but are not currently schema-validated:

```yaml
---
title: Post title
description: Short summary used on cards and in metadata
tags:
  - tech
heroImage: example-post/hero.jpg
createdAt: 2026-07-10
layout: ../../layouts/BlogPost.astro
---
```

### About page and content collection

`src/pages/about.astro` combines two content sources:

- Biography, skills, education, and work history from
  `src/constants/about.ts`.
- Side projects from the `sideProjects` content collection.

`src/content.config.ts` validates every side-project Markdown file before the
site builds. A side-project entry looks like this:

```yaml
---
title: Project name
status: In Progress
links:
  - label: Repository
    href: https://github.com/example/project
stack:
  - Astro
  - TypeScript
order: 1
---

Short project description written in Markdown.
```

The About page loads the collection with `getCollection`, sorts entries by
`order`, renders their Markdown, and passes the result to `SideProjects.vue`.

## Components and client JavaScript

- `Header.astro` owns desktop/mobile navigation and persists across Astro page
  transitions. Its browser script handles the mobile menu and active links.
- `MainHead.astro` installs Astro's client router and applies the saved or system
  theme before the page paints.
- `ThemeToggleButton.vue` uses `client:load`, so it is the main hydrated island
  shipped to the browser.
- `SideProjects.vue` has no client directive and therefore renders as static
  HTML.
- React icon components render to static SVG markup.
- `Mermaid.tsx` dynamically loads Mermaid when used as a hydrated component.

This keeps the normal reading experience static while isolating interactive
behavior.

## Styling

`styles/global.css` imports Tailwind and defines shared theme behavior. Other
stylesheets are scoped by purpose:

- `home.css` — homepage archive rows and responsive layout.
- `blog-post.css` — article headers, media, and Markdown typography.
- `about.css` — portfolio sections, history, and side projects.
- `header-link.css` — active navigation states.
- `theme-toggle.css` — the interactive light/dark selector.
- `not-found.css` — the 404 route.

Dark mode uses the `dark` class on `<html>`. The inline head script applies the
saved or system theme before paint, and the Vue selector updates it afterward.
Reduced-motion media queries disable nonessential animation.

## Development

Use Node.js 22.12 or newer. The repository is pinned to npm 10.9.3 through its
`packageManager` field.

Install dependencies and start the local server:

```sh
npm install
npm run dev
```

Available commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Astro development server |
| `npm run build` | Type-check the project and generate the static site |
| `npm run preview` | Preview the generated site locally |
| `npm run astro -- <command>` | Run an Astro CLI command |

The production output is written to `dist/` and can be served by any static
hosting provider. GitHub Actions runs `npm ci` and `npm run build` for pull
requests and pushes to `main`; Dependabot checks npm and GitHub Actions updates
weekly.
