import type { Metadata } from "next";
import { ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getPostsByDay } from "@/services/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string; day: string }>;
}): Promise<Metadata> {
  const { year, month, day } = await params;
  return {
    title: `${year}.${month}.${day}.`,
    alternates: { canonical: `/${year}/${month}/${day}/` },
  };
}

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
