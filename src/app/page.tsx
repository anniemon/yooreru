import {
  ArchivePostList,
  ArchiveShell,
  HomeCalendar,
  HomeCategoryNavigation,
  HomeToolbar,
  QueryEmptyState,
  SiteFooter,
  SiteHeader,
} from "@/components/site";
import { searchPosts } from "@/lib/content";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ s?: string; subscribed?: string }>;
}) {
  const { s, subscribed } = await searchParams;
  const query = s?.trim() ?? "";

  if (query) {
    const posts = await searchPosts(query);

    return (
      <ArchiveShell title={query}>
        {posts.length ? <ArchivePostList posts={posts} /> : <QueryEmptyState message="No posts." />}
      </ArchiveShell>
    );
  }

  return (
    <>
      <HomeToolbar subscribed={subscribed === "1"} />
      <SiteHeader home />
      <HomeCategoryNavigation />
      <HomeCalendar />
      <div style={{ height: "50px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <SiteFooter />
    </>
  );
}
