---
title: How this Astro blog is wired
description: Static routes, content modules, islands, and multi-framework components
slug: astro-blog
tags:
  - tech
heroImage: /posts/astro-blog.svg
createdAt: 2026-06-17
layout: ../../layouts/BlogPost.astro
---

## The short version

This blog is mostly static HTML. Astro handles pages, layouts, markdown, and build-time routing. JavaScript is added only where a component needs it.

Current shape:

- Markdown posts live in `src/pages/posts`.
- `BlogPost.astro` wraps each post in the same layout.
- `index.astro` reads post modules with `import.meta.glob`.
- React and Vue are optional islands, not the foundation of the site.
- Most of the page is still Astro-rendered HTML.

## Under the hood

The important split is server output vs client islands.

`BlogPost.astro`, `Header.astro`, `Footer.astro`, and the post markdown render into HTML during build. They do not need a client runtime just to exist in the browser.

Components with client behavior are different. They become islands: small framework components that Astro can hydrate independently.

## Route and content flow

Each post has frontmatter like this:

```yaml
title: How this Astro blog is wired
description: Static routes, content modules, islands, and multi-framework components
heroImage: /posts/astro-blog.svg
createdAt: 2026-06-17
layout: ../../layouts/BlogPost.astro
```

Astro turns `src/pages/posts/astro-blog.md` into:

```text
/posts/astro-blog/
```

The homepage reads all post files with:

```ts
const postModules = import.meta.glob<PostModule>("../pages/posts/*.md", {
  eager: true,
});
```

Then it sorts by `createdAt`, picks a featured post, and renders the rest as cards.

## Multi-framework support

Astro is not locked into React, Vue, or any other UI framework. The base layer is `.astro` files, markdown, and static HTML. Framework integrations are opt-in adapters for the components that need them.

This site currently registers React and Vue:

```js
export default defineConfig({
  integrations: [react(), vue()],
});
```

That means the page can use:

```astro
<ThemeToggle client:load />
<SideProjects projects={aboutSideProjects} />
```

The important detail is that neither framework owns the page. React is used for one interactive theme toggle. Vue is used for one side-project section as a learning exercise. Either one could be replaced with Astro, Svelte, Solid, or plain browser JavaScript without rewriting the whole site.

## Hydration model

By default, an Astro component ships HTML only. A framework component can opt into browser JavaScript with a client directive:

```astro
<ThemeToggle client:load />
```

That tells Astro to render the component and also ship enough React runtime code to hydrate that one island after page load.

The Vue side-project component does not need client interactivity right now, so it can render as static HTML. The component is still authored in Vue, but the browser does not need to hydrate it unless I add a directive such as `client:load`, `client:idle`, or `client:visible`.

## Why this is useful

The practical benefit is control:

- Static content stays static.
- Interactive UI is isolated.
- React and Vue can coexist without locking the whole site into either framework.
- The final build is still a set of static routes.
