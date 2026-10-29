import { Suspense } from "react";
import type { Metadata } from "next";
import { Comments } from "@/components/comments";
import { PostViewTracker } from "@/components/post-view-tracker";
import { PostNavigation, PostTagLinks, SiteHeader, SubscribeButton } from "@/components/site";
import { getAdjacentPosts, getPostByDateSlug, postHref } from "@/services/content";
import type { BlogPost } from "@/lib/blog-types";
import { PostArticle } from "@/components/post-article";

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

  return (
    <>
      <PostViewTracker postId={post.id} />
      <SiteHeader />
      <PostArticle post={post} />
      <PostTagLinks post={post} />
      <div style={{ height: "150px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <Suspense fallback={<PostNavigation previous={null} next={null} />}>
        <AdjacentNavigation post={post} />
      </Suspense>
      <div className="post-subscribe">
        <SubscribeButton />
      </div>
      <Comments post={post} />
      <div className="wp-block-columns is-layout-flex">
        <div className="wp-block-column is-layout-flow">
          <div style={{ height: "50px" }} aria-hidden="true" className="wp-block-spacer"></div>
        </div>
      </div>
    </>
  );
}
