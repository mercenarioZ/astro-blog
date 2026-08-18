// Fills in the boilerplate frontmatter every post in src/pages/posts shares,
// so a new post only has to declare its own content fields.
const DEFAULTS = {
  layout: "../../layouts/BlogPost.astro",
  tags: ["tech"],
};

export const remarkPostDefaults = () => (_tree, file) => {
  const path = file.history[0] ?? "";

  if (!path.includes("/pages/posts/")) return;

  const frontmatter = file.data.astro.frontmatter;

  for (const [key, value] of Object.entries(DEFAULTS)) {
    frontmatter[key] ??= value;
  }
};
