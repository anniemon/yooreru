import { ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getCategoryBySlugs, getPostsByCategory } from "@/lib/content";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const [posts, category] = await Promise.all([getPostsByCategory(slug), getCategoryBySlugs(slug)]);
  const title = category?.name ?? (slug.length ? decodeURIComponent(slug.at(-1) ?? "") : "category");

  return (
    <ArchiveShell title={title} description={category?.description || undefined}>
      {posts.length ? <ArchivePostList posts={posts} /> : <QueryEmptyState message="No posts." />}
    </ArchiveShell>
  );
}
