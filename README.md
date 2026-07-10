# MercenarioZ's blog

A static personal blog and portfolio built with Astro, Tailwind CSS, and small
framework islands where interactivity benefits from them.

## Development

```sh
npm install
npm run dev
```

Useful commands:

```sh
npm run build    # Type-check and create the production build
npm run preview  # Preview the production build locally
```

## Project structure

- `src/pages/` contains routes and Markdown posts.
- `src/layouts/` owns the shared document and blog-post shells.
- `src/components/` contains reusable Astro and framework components.
- `src/content/side-projects/` stores side-project collection entries.
- `src/lib/posts.ts` loads, sorts, and formats post metadata.
- `styles/` contains global and page-specific styles.
- `public/` contains static images and icons.

Most UI renders as static Astro HTML. Vue powers the animated theme toggle,
while React support remains available for server-rendered icons and optional
interactive components.
