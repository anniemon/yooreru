import { SITE } from "@/lib/constants";
import { getPublishedPosts, postHref } from "@/lib/content";
import { cdata, escapeXml } from "@/lib/xml";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await getPublishedPosts();
  const items = posts
    .map((post) => {
      const href = `${SITE.url}${postHref(post)}`;
      return `
        <item>
          <title>${escapeXml(post.title)}</title>
          <link>${escapeXml(href)}</link>
          <guid>${escapeXml(href)}</guid>
          <pubDate>${(post.publishedAt ?? new Date()).toUTCString()}</pubDate>
          <description>${cdata(post.excerpt)}</description>
          <content:encoded>${cdata(post.contentHtml)}</content:encoded>
        </item>`;
    })
    .join("");

  return new Response(`<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
      <channel>
        <title>${escapeXml(SITE.name)}</title>
        <link>${escapeXml(SITE.url)}</link>
        <description>${escapeXml(SITE.tagline)}</description>
        ${items}
      </channel>
    </rss>`, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
