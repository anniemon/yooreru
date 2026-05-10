import { ArchivePagination, ArchivePostList, ArchiveShell, QueryEmptyState } from "@/components/site";
import { getCategoryArchivePage, getCategoryBySlugs } from "@/lib/content";

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
