import type { ImageMetadata } from "astro";

export type ImageSource = ImageMetadata | string;

type ImageModule = {
  default: ImageMetadata;
};

const rasterModules = import.meta.glob<ImageModule>(
  "../assets/posts/**/*.{avif,jpeg,jpg,png,webp}",
  { eager: true },
);

const vectorUrls = import.meta.glob<string>("../assets/posts/**/*.svg", {
  eager: true,
  import: "default",
  query: "?no-inline",
});

const getAssetKey = (path: string) => path.split("/assets/posts/")[1];

const postImages = new Map<string, ImageSource>([
  ...Object.entries(rasterModules).map(
    ([path, module]) => [getAssetKey(path), module.default] as const,
  ),
  ...Object.entries(vectorUrls).map(
    ([path, url]) => [getAssetKey(path), url] as const,
  ),
]);

export const getPostImage = (key: string): ImageSource => {
  const normalizedKey = key.replace(/^\/?posts\//, "");
  const image = postImages.get(normalizedKey);

  if (!image) {
    throw new Error(`Unknown post image: ${key}`);
  }

  return image;
};
