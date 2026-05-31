import Link from "next/link";
import { HomeCalendarClient } from "@/components/home-calendar";
import { SubscribeForm } from "@/components/subscribe-form";
import { SITE } from "@/lib/constants";
import { getCategories, getPublishedPostLinks, postHref } from "@/services/content";
import type { BlogCategory, BlogPost, BlogPostLink } from "@/lib/blog-types";
import { formatWpDate as formatAppWpDate, getAppTimeZone, getZonedCalendarParts } from "@/lib/time-zone";

type CategoryTreeNode = BlogCategory & {
  children: BlogCategory[];
};

function SearchIcon() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M13 5c-3.3 0-6 2.7-6 6 0 1.4.5 2.7 1.3 3.7l-3.8 3.8 1.1 1.1 3.8-3.8c1 .8 2.3 1.3 3.7 1.3 3.3 0 6-2.7 6-6S16.3 5 13 5zm0 10.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z" />
    </svg>
  );
}

function buildCategoryTree(categories: BlogCategory[]): CategoryTreeNode[] {
  return categories
    .filter(
      (category) =>
        !category.parentSlug &&
        (category.postCount > 0 || categories.some((child) => child.parentSlug === category.slug && child.postCount > 0)),
    )
    .map((category) => ({
      ...category,
      children: categories
        .filter((child) => child.parentSlug === category.slug && child.postCount > 0)
        .sort((left, right) => left.name.localeCompare(right.name)),
    }));
}

export function formatWpDate(date: Date | null) {
  return formatAppWpDate(date);
}

export function formatArchiveMonthTitle(year: string, month: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getAppTimeZone(),
    month: "long",
    year: "numeric",
    // timezone에 영향 받지 않고 월을 가져오기 위해 달의 15일 12시를 씀.
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 15, 12)));
}

export function SiteHeader({ home = false }: { home?: boolean } = {}) {
  return (
    <header className="wp-block-group alignfull main_header has-primary-color has-custom-color-5-background-color has-text-color has-background has-link-color has-cabin-font-family has-medium-font-size is-content-justification-center is-nowrap is-layout-flex is-position-sticky">
      <h1
        className={`has-text-align-center has-link-color main_header wp-block-site-title has-text-color has-secondary-color has-background has-medium-font-size has-cabin-font-family ${home ? "site-title-home" : "site-title-simple"}`}
      >
        <Link href="/" rel="home">
          {SITE.name}
        </Link>
      </h1>
    </header>
  );
}

export function HomeToolbar() {
  return (
    <>
      <div style={{ height: "20px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <div className="wp-block-columns has-background is-layout-flex home-utility-band">
        <div className="wp-block-column has-custom-background-color has-background has-global-padding is-content-justification-center is-layout-constrained home-utility-column">
          <div className="wp-block-group is-content-justification-space-between is-nowrap is-layout-flex home-utility-row">
            <div className="wp-block-buttons has-cabin-font-family is-content-justification-center is-nowrap is-layout-flex home-profile-buttons">
              <div className="wp-block-button has-custom-width wp-block-button__width-100 has-custom-font-size is-style-fill has-dm-mono-font-family has-small-font-size">
                <a
                  className="wp-block-button__link has-custom-color-5-color has-text-color has-background has-link-color has-text-align-center wp-element-button profile-pill"
                  href={SITE.profileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  profile
                </a>
              </div>
            </div>
            <form
              role="search"
              method="get"
              action="/"
              className="wp-block-search__button-outside wp-block-search__icon-button alignright search-button wp-block-search home-search-form"
            >
              <label className="wp-block-search__label screen-reader-text" htmlFor="wp-block-search__input-1">
                검색
              </label>
              <div className="wp-block-search__inside-wrapper">
                <input className="wp-block-search__input" id="wp-block-search__input-1" type="search" name="s" />
                <button
                  aria-label="검 색"
                  className="wp-block-search__button has-text-color has-custom-color-5-color has-background has-secondary-background-color has-icon wp-element-button"
                  type="submit"
                >
                  <SearchIcon />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div style={{ height: "30px" }} aria-hidden="true" className="wp-block-spacer"></div>
    </>
  );
}

export async function HomeCategoryNavigation() {
  const categories = buildCategoryTree(await getCategories());

  return (
    <div className="wp-block-columns has-primary-color has-text-color has-link-color is-layout-flex home-category-band">
      <div className="wp-block-column has-primary-color has-custom-background-color has-text-color has-background has-link-color has-global-padding is-content-justification-center is-layout-constrained">
        <ul className="wp-block-categories-list wp-block-categories-taxonomy-category aligncenter wp-block-categories has-medium-font-size has-cabin-font-family">
          {categories.map((category) => (
            <li key={category.id} className={`cat-item cat-item-${category.id}`}>
              <Link href={`/category/${encodeURIComponent(category.slug)}/`}>{category.name}</Link>
              {category.children.length ? (
                <ul className="children">
                  {category.children.map((child) => (
                    <li key={child.id} className={`cat-item cat-item-${child.id}`}>
                      <Link href={`/category/${category.slug}/${encodeURIComponent(child.slug)}/`}>{child.name}</Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export async function HomeCalendar() {
  const posts = await getPublishedPostLinks();
  const today = getZonedCalendarParts(new Date());
  const entries = posts.flatMap((post) => {
    if (!post.publishedAt) {
      return [];
    }
    const dateParts = getZonedCalendarParts(post.publishedAt);

    return [
      {
        day: dateParts.day,
        href: postHref(post),
        monthIndex: dateParts.monthIndex,
        title: post.title,
        year: dateParts.year,
      },
    ];
  });

  return (
    <div className="wp-block-columns is-not-stacked-on-mobile has-luminous-vivid-orange-color has-custom-background-color has-text-color has-background has-link-color is-layout-flex home-calendar-band">
      <div className="wp-block-column is-vertically-aligned-center has-custom-background-color has-background has-large-font-size has-global-padding is-content-justification-center is-layout-constrained">
        <HomeCalendarClient
          entries={entries}
          initialMonthIndex={today.monthIndex}
          initialYear={today.year}
        />
      </div>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="wp-block-template-part">
      <div className="wp-block-columns is-not-stacked-on-mobile has-vivid-green-cyan-background-color has-background is-layout-flex site-footer-grid">
        <div className="wp-block-column is-vertically-aligned-center is-layout-flow">
          <div className="wp-block-group is-content-justification-center is-nowrap is-layout-flex">
            <p className="wp-block-site-tagline has-text-color has-secondary-color has-background has-vivid-green-cyan-background-color has-cabin-font-family">
              {SITE.tagline}
            </p>
          </div>
        </div>
        <div className="wp-block-column is-vertically-aligned-center is-style-button has-border-color has-vivid-green-cyan-border-color has-primary-color has-text-color has-1-rem-font-size has-global-padding is-layout-constrained">
          <div className="wp-block-buttons has-custom-font-size has-small-font-size is-horizontal is-nowrap is-layout-flex">
            <div className="wp-block-button has-custom-width wp-block-button__width-100 has-custom-font-size is-style-fill has-cabin-font-family footer-link-button">
              <Link
                className="wp-block-button__link has-custom-color-5-color has-vivid-green-cyan-background-color has-text-color has-background has-link-color wp-element-button"
                href={SITE.contactPath}
              >
                <span>그네에게 메시지 보내기</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="wp-block-column is-style-button is-vertically-aligned-bottom has-border-color has-vivid-green-cyan-border-color has-primary-color has-vivid-green-cyan-background-color has-text-color has-background has-link-color has-1-rem-font-size is-layout-flow footer-subscribe-column">
          <details className="footer-subscribe-details">
            <summary className="footer-subscribe-summary">
              <strong>구독하기</strong>
            </summary>
            <SubscribeForm />
          </details>
        </div>
      </div>
    </footer>
  );
}

export function ArchiveShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <div style={{ height: "100px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <main id="wp--skip-link--target" className="wp-block-query has-global-padding is-layout-constrained wp-block-query-is-layout-constrained">
        <h2 className="wp-block-query-title has-text-color has-secondary-color">{title}</h2>
        {description ? (
          <div className="wp-block-term-description">
            <p>{description}</p>
          </div>
        ) : null}
        <div style={{ height: "100px" }} aria-hidden="true" className="wp-block-spacer"></div>
        {children}
        <div className="wp-block-group alignwide is-layout-flow wp-block-group-is-layout-flow archive-tail-spacer"></div>
      </main>
    </>
  );
}

export function ArchivePostList({ posts }: { posts: BlogPost[] }) {
  return (
    <ul className="alignwide wp-block-post-template is-layout-flow wp-block-post-template-is-layout-flow">
      {posts.map((post) => (
        <li key={post.id} className={`wp-block-post post-${post.id}`}>
          <div className="wp-block-columns are-vertically-aligned-center is-layout-flex">
            <div className="wp-block-column is-vertically-aligned-center is-layout-flow archive-post-column">
              <div className="wp-block-group is-layout-flow archive-post-row">
                <div className="wp-block-columns are-vertically-aligned-center is-not-stacked-on-mobile has-small-font-size is-layout-flex archive-post-grid">
                  <div className="wp-block-column is-vertically-aligned-center has-medium-font-size is-layout-flow archive-date-column">
                    <div className="has-text-align-left has-link-color wp-block-post-date has-text-color has-primary-color has-background has-custom-color-3-background-color has-medium-font-size">
                      <time dateTime={post.publishedAt?.toISOString()}>{formatWpDate(post.publishedAt)}</time>
                    </div>
                  </div>
                  <div className="wp-block-column is-vertically-aligned-center is-layout-flow archive-title-column">
                    <h1 className="has-text-align-left has-link-color wp-block-post-title has-text-color has-secondary-color has-background has-custom-color-3-background-color has-cabin-font-family">
                      <Link href={postHref(post)}>{post.title}</Link>
                    </h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ArchivePagination({
  basePath,
  currentPage,
  hasNext,
}: {
  basePath: string;
  currentPage: number;
  hasNext: boolean;
}) {
  if (currentPage <= 1 && !hasNext) {
    return null;
  }

  const normalizedBasePath = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const previousHref = currentPage > 2 ? `${normalizedBasePath}page/${currentPage - 1}/` : normalizedBasePath;
  const nextHref = `${normalizedBasePath}page/${currentPage + 1}/`;

  return (
    <div className="wp-block-group alignwide is-layout-flow wp-block-group-is-layout-flow archive-pagination-shell">
      <nav
        className="has-link-color alignwide wp-block-query-pagination has-text-color has-secondary-color has-background has-custom-color-3-background-color has-small-font-size has-dm-mono-font-family is-content-justification-space-between is-nowrap is-layout-flex wp-block-query-pagination-is-layout-flex archive-pagination"
        aria-label="Pagination"
      >
        {currentPage > 1 ? (
          <Link href={previousHref} className="wp-block-query-pagination-previous has-small-font-size">
            Previous Page
          </Link>
        ) : null}
        {hasNext ? (
          <Link href={nextHref} className="wp-block-query-pagination-next has-small-font-size">
            Next Page
          </Link>
        ) : null}
      </nav>
    </div>
  );
}

export function QueryEmptyState({ message }: { message: string }) {
  return (
    <div className="alignwide query-empty-state">
      <p>{message}</p>
    </div>
  );
}

export function PostTagLinks({ post }: { post: BlogPost }) {
  if (!post.tags.length) {
    return null;
  }

  return (
    <div className="wp-block-post-terms post-tags has-global-padding">
      <span className="wp-block-post-terms__prefix">Tags: </span>
      {post.tags.map((tag, index) => (
        <span key={tag.id}>
          <Link href={`/tag/${encodeURIComponent(tag.slug)}/`} rel="tag">
            {tag.name}
          </Link>
          {index < post.tags.length - 1 ? <span className="wp-block-post-terms__separator">, </span> : null}
        </span>
      ))}
    </div>
  );
}

export function PostNavigation({
  previous,
  next,
}: {
  previous: BlogPostLink | null;
  next: BlogPostLink | null;
}) {
  return (
    <div className="wp-block-columns is-not-stacked-on-mobile is-layout-flex post-navigation-grid">
      <div className="wp-block-column has-global-padding is-layout-constrained post-navigation-column">
        <div className="post-navigation-link-previous has-text-align-right wp-block-post-navigation-link has-small-font-size">
          {previous ? (
            <>
              <span className="wp-block-post-navigation-link__arrow-previous is-arrow-chevron" aria-hidden="true">
                «
              </span>
              <Link href={postHref(previous)} rel="prev">
                Previous
              </Link>
            </>
          ) : null}
        </div>
      </div>
      <div className="wp-block-column is-vertically-aligned-top has-small-font-size has-global-padding is-layout-constrained post-navigation-column">
        <div className="post-navigation-link-next wp-block-post-navigation-link has-small-font-size">
          {next ? (
            <>
              <Link href={postHref(next)} rel="next">
                Next
              </Link>
              <span className="wp-block-post-navigation-link__arrow-next is-arrow-chevron" aria-hidden="true">
                »
              </span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
