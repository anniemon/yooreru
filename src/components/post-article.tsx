import Link from "next/link";
import { formatWpDate } from "@/components/site";
import { getPostFontFamily } from "@/lib/post-font";
import type { BlogPost } from "@/lib/blog-types";

export function PostArticle({
  post,
}: {
  post: Pick<BlogPost, "title" | "contentHtml" | "publishedAt"> & { author: BlogPost["author"] | null };
}) {
  return (
    <>
      <div style={{ height: "100px" }} aria-hidden="true" className="wp-block-spacer"></div>
      <div className="wp-block-columns alignfull is-not-stacked-on-mobile is-layout-flex post-heading-band">
        <div className="wp-block-column has-global-padding is-layout-constrained post-heading-column">
          <h4
            className="has-link-color alignwide wp-block-post-title has-text-color has-secondary-color has-background has-custom-color-3-background-color"
            style={{ fontFamily: getPostFontFamily(post.contentHtml) }}
          >
            {post.title}
          </h4>
          {post.publishedAt ? (
            <div className="has-link-color wp-block-post-date has-text-color has-luminous-vivid-orange-color has-background has-custom-color-3-background-color has-dm-mono-font-family">
              <time dateTime={post.publishedAt.toISOString()}>{formatWpDate(post.publishedAt)}</time>
            </div>
          ) : null}
          <div className="has-link-color wp-block-post-author-name has-text-color has-custom-color-2-color has-cabin-font-family">
            {post.author ? (
              <Link className="wp-block-post-author-name__link underline" href={`/author/${post.author.id}/`}>
                {post.author.name}
              </Link>
            ) : "작성자 미지정"}
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
    </>
  );
}
