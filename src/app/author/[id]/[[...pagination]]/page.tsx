import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArchivePagination, ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getAuthorArchivePage } from "@/services/content";

const POSTS_PER_PAGE = 7;
type AuthorParams = Promise<{ id: string; pagination?: string[] }>;

function parseAuthorRoute(id: string, pagination?: string[]) {
  const authorId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(authorId) || authorId < 1) notFound();

  if (!pagination?.length) return { authorId, page: 1 };
  if (pagination.length !== 2 || pagination[0] !== "page" || !/^[1-9]\d*$/.test(pagination[1])) notFound();

  const page = Number(pagination[1]);
  if (!Number.isSafeInteger(page)) notFound();
  return { authorId, page };
}

export async function generateMetadata({ params }: { params: AuthorParams }): Promise<Metadata> {
  const { id, pagination } = await params;
  const { authorId, page } = parseAuthorRoute(id, pagination);
  const archive = await getAuthorArchivePage(authorId, page, POSTS_PER_PAGE);
  if (!archive) notFound();

  const basePath = `/author/${authorId}/`;
  return {
    title: archive.authorName,
    alternates: { canonical: page === 1 ? basePath : `${basePath}page/${page}/` },
  };
}

export default async function AuthorPage({ params }: { params: AuthorParams }) {
  const { id, pagination } = await params;
  const { authorId, page } = parseAuthorRoute(id, pagination);
  const archive = await getAuthorArchivePage(authorId, page, POSTS_PER_PAGE);
  if (!archive) notFound();

  return (
    <ArchiveShell title={archive.authorName}>
      {archive.posts.length ? (
        <>
          <ArchivePostList posts={archive.posts} />
          <ArchivePagination basePath={`/author/${authorId}/`} currentPage={page} hasNext={archive.hasNext} />
        </>
      ) : (
        <QueryEmptyState message="No posts." />
      )}
    </ArchiveShell>
  );
}
