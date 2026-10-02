import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Comments } from "@/components/comments";
import { PostNavigation, PostTagLinks, SiteHeader, formatWpDate } from "@/components/site";
import { getAdjacentPosts, getPostByDateSlug, postHref } from "@/services/content";
import type { BlogPost } from "@/lib/blog-types";

type PostParams = Promise<{ year: string; month: string; day: string; slug: string }>;

export async function generateMetadata({ params }: { params: PostParams }): Promise<Metadata> {
  const { year, month, day, slug } = await params;
  const post = await getPostByDateSlug(year, month, day, slug);
  const url = postHref(post);
  const description = post.excerpt || undefined;

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
    },
  };
}

async function AdjacentNavigation({ post }: { post: BlogPost }) {
  const adjacent = await getAdjacentPosts(post);
  return <PostNavigation previous={adjacent.previous} next={adjacent.next} />;
}

export default async function PostPage({
  params,
}: {
  params: PostParams;
}) {
  const { year, month, day, slug } = await params;
  const post = await getPostByDateSlug(year, month, day, slug);
  const authorCategory = post.author.name === "노서정" ? "elephantrunk" : post.author.name === "그네" ? "fingertip" : null;

  return (
    <>
      <SiteHeader />
      <div style={{ height: "100px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <div className="wp-block-columns alignfull is-not-stacked-on-mobile is-layout-flex post-heading-band">
        <div className="wp-block-column has-global-padding is-layout-constrained post-heading-column">
          <h4 className="has-link-color alignwide wp-block-post-title has-text-color has-secondary-color has-background has-custom-color-3-background-color">
            {post.title}
          </h4>
          <div className="has-link-color wp-block-post-date has-text-color has-luminous-vivid-orange-color has-background has-custom-color-3-background-color has-dm-mono-font-family">
            <time dateTime={post.publishedAt?.toISOString()}>{formatWpDate(post.publishedAt)}</time>
          </div>
          <div className="has-link-color wp-block-post-author-name has-text-color has-custom-color-2-color has-cabin-font-family">
            {authorCategory ? (
              <Link className="wp-block-post-author-name__link underline" href={`/category/diary/${authorCategory}/`}>
                {post.author.name}
              </Link>
            ) : (
              <span className="wp-block-post-author-name__link">{post.author.name}</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ height: "30px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <div className="wp-block-template-part">
        <div
          className="entry-content wp-block-post-content has-global-padding is-layout-constrained"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </div>
      <PostTagLinks post={post} />
      <div style={{ height: "150px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <Suspense fallback={<PostNavigation previous={null} next={null} />}>
        <AdjacentNavigation post={post} />
      </Suspense>
      <Comments post={post} />
      <div className="wp-block-columns is-layout-flex">
        <div className="wp-block-column is-layout-flow">
          <div style={{ height: "50px" }} aria-hidden="true" className="wp-block-spacer"></div>
        </div>
      </div>
    </>
  );
}
