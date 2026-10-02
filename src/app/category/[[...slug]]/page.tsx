import type { Metadata } from "next";
import { ArchivePagination, ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getCategoryArchivePage, getCategoryBySlugs } from "@/services/content";

const POSTS_PER_CATEGORY_PAGE = 7;

function parseCategoryRoute(slug: string[]) {
  const pageIndex = slug.findIndex((part) => part === "page");
  if (pageIndex === -1) {
    return {
      categorySlugs: slug,
      page: 1,
    };
  }

  const page = Number(slug[pageIndex + 1]);
  return {
    categorySlugs: slug.slice(0, pageIndex),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug = [] } = await params;
  const { categorySlugs, page } = parseCategoryRoute(slug);
  const category = await getCategoryBySlugs(categorySlugs);
  const basePath = `/category/${categorySlugs.map(encodeURIComponent).join("/")}/`;
  return {
    title: category?.name ?? "카테고리",
    description: category?.description || undefined,
    alternates: { canonical: page === 1 ? basePath : `${basePath}page/${page}/` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const { categorySlugs, page } = parseCategoryRoute(slug);
  const [archive, category] = await Promise.all([
    getCategoryArchivePage(categorySlugs, page, POSTS_PER_CATEGORY_PAGE),
    getCategoryBySlugs(categorySlugs),
  ]);
  const title = category?.name ?? (categorySlugs.length ? decodeURIComponent(categorySlugs.at(-1) ?? "") : "category");
  const basePath = `/category/${categorySlugs.map(encodeURIComponent).join("/")}/`;

  return (
    <ArchiveShell title={title} description={category?.description || undefined}>
      {archive.posts.length ? (
        <>
          <ArchivePostList posts={archive.posts} />
          <ArchivePagination basePath={basePath} currentPage={archive.page} hasNext={archive.hasNext} />
        </>
      ) : (
        <QueryEmptyState message="No posts." />
      )}
    </ArchiveShell>
  );
}
