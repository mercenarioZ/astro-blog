import { getPostImage, type ImageSource } from "./images";

interface PostFrontmatter<HeroImage> {
  createdAt: string;
  heroImage: HeroImage;
  tag?: string[];
  tags?: string[];
  title: string;
  description: string;
}

interface RawPostModule {
  url: string;
  frontmatter: PostFrontmatter<string>;
}

export interface PostModule {
  url: string;
  frontmatter: PostFrontmatter<ImageSource>;
}

const postModules = import.meta.glob<RawPostModule>(
  ["../pages/posts/*.md", "../pages/posts/*.mdx"],
  { eager: true },
);

const postDateFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const formatTag = (tag: string) =>
  tag.charAt(0).toUpperCase() + tag.slice(1);

export const getPosts = () =>
  Object.values(postModules)
    .map((post) => ({
      ...post,
      frontmatter: {
        ...post.frontmatter,
        heroImage: getPostImage(post.frontmatter.heroImage),
      },
    }))
    .toSorted(
      (a, b) =>
        new Date(b.frontmatter.createdAt).valueOf() -
        new Date(a.frontmatter.createdAt).valueOf(),
    );

export const getPostTags = (post: PostModule) =>
  (post.frontmatter.tags ?? post.frontmatter.tag ?? ["Post"]).map(formatTag);

export const getPostDate = (post: PostModule) =>
  postDateFormatter.format(new Date(post.frontmatter.createdAt));
