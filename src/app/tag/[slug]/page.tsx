import { ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getPostsByTag, getTagBySlug } from "@/lib/content";

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [posts, tag] = await Promise.all([getPostsByTag(slug), getTagBySlug(slug)]);
  const title = tag?.name ?? decodeURIComponent(slug);

  return (
    <ArchiveShell title={title}>
      {posts.length ? <ArchivePostList posts={posts} /> : <QueryEmptyState message="No posts." />}
    </ArchiveShell>
  );
}
