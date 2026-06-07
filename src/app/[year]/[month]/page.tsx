import { ArchivePostList, ArchiveShell, QueryEmptyState, formatArchiveMonthTitle } from "@/components/site";
import { getPostsByMonth } from "@/services/content";

export default async function MonthArchive({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const posts = await getPostsByMonth(year, month);

  return (
    <ArchiveShell title={formatArchiveMonthTitle(year, month)}>
      {posts.length ? <ArchivePostList posts={posts} /> : <QueryEmptyState message="No posts." />}
    </ArchiveShell>
  );
}
