import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";
import { getPublishedPostLinks, postHref } from "@/services/content";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPostLinks();
  return [
    { url: SITE.url },
    ...posts.map((post) => ({ url: `${SITE.url}${postHref(post)}` })),
  ];
}
