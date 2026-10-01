import { ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getPostsByDay } from "@/services/content";

export default async function DayArchive({
  params,
}: {
  params: Promise<{ year: string; month: string; day: string }>;
}) {
  const { year, month, day } = await params;
  const posts = await getPostsByDay(year, month, day);

  return (
    <ArchiveShell title={`${year}.${month}.${day}.`}>
      {posts.length ? <ArchivePostList posts={posts} /> : <QueryEmptyState message="No posts." />}
    </ArchiveShell>
  );
}
