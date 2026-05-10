import { createHash } from "node:crypto";
import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "./prisma";
import type { PostGetPayload } from "@/generated/prisma/models";
import type { BlogCategory, BlogComment, BlogPost, BlogTag } from "./blog-types";
import { formatDatePathParts, getZonedMonthKey } from "./time-zone";

const postInclude = {
  category: { include: { parent: true, _count: { select: { posts: true } } } },
  postTags: {
    include: {
      tag: { include: { _count: { select: { postTags: true } } } },
    },
  },
  comments: {
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
  },
} as const;

type DbPost = PostGetPayload<{ include: typeof postInclude }>;

function mapCategory(category: {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent?: { slug: string } | null;
  _count?: { posts: number };
}): BlogCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    parentSlug: category.parent?.slug,
    postCount: category._count?.posts ?? 0,
  };
}

function mapTag(tag: {
  id: number;
  name: string;
  slug: string;
  _count?: { postTags: number };
}): BlogTag {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    postCount: tag._count?.postTags ?? 0,
  };
}

function mapComment(comment: {
  id: number;
  postId: number;
  parentId: number | null;
  authorName: string;
  authorEmail: string | null;
  content: string;
  createdAt: Date;
}): BlogComment {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    authorName: comment.authorName,
    authorEmailHash: comment.authorEmail
      ? createHash("md5")
          .update(comment.authorEmail.trim().toLowerCase())
          .digest("hex")
      : undefined,
    content: comment.content,
    createdAt: comment.createdAt,
  };
}

function nestComments(comments: BlogComment[]) {
  const byId = new Map(comments.map((comment) => [comment.id, { ...comment, children: [] as BlogComment[] }]));
  const roots: BlogComment[] = [];

  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)?.children?.push(comment);
    } else {
      roots.push(comment);
    }
  }

  return roots;
}

function getHtmlAttribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tag.match(new RegExp(`\\s${escapedName}="([^"]*)"`, "i"))?.[1] ?? null;
}

function setHtmlAttribute(tag: string, name: string, value: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attributePattern = new RegExp(`(\\s${escapedName}=)"[^"]*"`, "i");
  if (attributePattern.test(tag)) {
    return tag.replace(attributePattern, `$1"${value}"`);
  }

  return tag.replace(/\s*\/?>$/, ` ${name}="${value}"$&`);
}

function optimizeContentImages(html: string) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const resizedUrl = getHtmlAttribute(tag, "data-url");
    const width = getHtmlAttribute(tag, "data-width");
    const height = getHtmlAttribute(tag, "data-height");
    let nextTag = tag;

    if (resizedUrl) {
      nextTag = setHtmlAttribute(nextTag, "src", resizedUrl);
    }

    if (width) {
      nextTag = setHtmlAttribute(nextTag, "width", width);
    }

    if (height) {
      nextTag = setHtmlAttribute(nextTag, "height", height);
    }

    nextTag = setHtmlAttribute(nextTag, "loading", "lazy");
    nextTag = setHtmlAttribute(nextTag, "decoding", "async");

    return nextTag;
  });
}

function mapPost(post: DbPost): BlogPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    contentHtml: optimizeContentImages(post.contentHtml),
    featuredImageUrl: post.featuredImageUrl,
    publishedAt: post.publishedAt,
    allowComments: post.allowComments,
    categories: post.category ? [mapCategory(post.category)] : [],
    tags: post.postTags.map((postTag) => mapTag(postTag.tag)),
    comments: nestComments(post.comments.map(mapComment)),
  };
}

async function getDbPublishedPosts() {
  if (!prisma) {
    return [];
  }

  return prisma.post.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
    },
    orderBy: [{ publishedAt: "desc" }],
    include: postInclude,
  });
}

export const getPublishedPosts = cache(async () => {
  const posts = await getDbPublishedPosts();
  return posts.map(mapPost);
});

export const getPostByDateSlug = cache(
  async (year: string, month: string, day: string, slug: string) => {
    const posts = await getPublishedPosts();
    const post = posts.find((item) => {
      if (!item.publishedAt) {
        return false;
      }
      const dateParts = formatDatePathParts(item.publishedAt);

      return (
        item.slug === decodeURIComponent(slug) &&
        dateParts.year === year &&
        dateParts.month === month &&
        dateParts.day === day
      );
    });

    if (!post) {
      notFound();
    }

    return post;
  },
);

export const getCategories = cache(async () => {
  if (!prisma) {
    return [];
  }

  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: { parent: true, _count: { select: { posts: true } } },
  });

  return categories.map(mapCategory);
});

export const getTags = cache(async () => {
  if (!prisma) {
    return [];
  }

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { postTags: true } } },
  });

  return tags.map(mapTag);
});

export async function getPostsByCategory(slugs: string[]) {
  const posts = await getPublishedPosts();
  const lastSlug = decodeURIComponent(slugs.at(-1) ?? "");

  return posts.filter((post) => post.categories[0]?.slug === lastSlug);
}

export async function getCategoryArchivePage(slugs: string[], page: number, pageSize: number) {
  const lastSlug = decodeURIComponent(slugs.at(-1) ?? "");
  const currentPage = Math.max(1, Math.floor(page));
  const skip = (currentPage - 1) * pageSize;

  if (!prisma) {
    return {
      posts: [],
      page: currentPage,
      hasNext: false,
    };
  }

  const where = {
    status: "PUBLISHED" as const,
    publishedAt: { lte: new Date() },
    category: { slug: lastSlug },
  };
  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }],
    skip,
    take: pageSize + 1,
    include: postInclude,
  });

  return {
    posts: posts.slice(0, pageSize).map(mapPost),
    page: currentPage,
    hasNext: posts.length > pageSize,
  };
}

export async function getPostsByTag(slug: string) {
  const posts = await getPublishedPosts();
  const decoded = decodeURIComponent(slug);

  return posts.filter((post) => post.tags.some((tag) => tag.slug === decoded));
}

export async function getCategoryBySlugs(slugs: string[]) {
  const categories = await getCategories();
  const lastSlug = decodeURIComponent(slugs.at(-1) ?? "");

  return categories.find((category) => category.slug === lastSlug) ?? null;
}

export async function getTagBySlug(slug: string) {
  const tags = await getTags();
  const decoded = decodeURIComponent(slug);

  return tags.find((tag) => tag.slug === decoded) ?? null;
}

export async function getPostsByMonth(year: string, month: string) {
  const posts = await getPublishedPosts();

  return posts.filter((post) => {
    if (!post.publishedAt) {
      return false;
    }

    return getZonedMonthKey(post.publishedAt) === `${year}-${month}`;
  });
}

export async function getArchiveMonths() {
  const posts = await getPublishedPosts();
  const counts = new Map<string, number>();

  for (const post of posts) {
    if (!post.publishedAt) {
      continue;
    }

    const key = getZonedMonthKey(post.publishedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([key, count]) => {
    const [year, month] = key.split("-");
    return { year, month, count };
  });
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function searchPosts(query: string) {
  const posts = await getPublishedPosts();
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return posts;
  }

  return posts.filter((post) => {
    const haystacks = [
      post.title,
      post.excerpt,
      stripHtml(post.contentHtml),
      post.categories.map((category) => category.name).join(" "),
      post.tags.map((tag) => tag.name).join(" "),
    ];

    return haystacks.some((value) => value.toLowerCase().includes(needle));
  });
}

export async function getAdjacentPosts(postId: number) {
  const posts = await getPublishedPosts();
  const index = posts.findIndex((post) => post.id === postId);

  if (index === -1) {
    return {
      previous: null,
      next: null,
    };
  }

  return {
    previous: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
  };
}

export function postHref(post: Pick<BlogPost, "slug" | "publishedAt">) {
  const date = post.publishedAt ?? new Date();
  const { year, month, day } = formatDatePathParts(date);

  return `/${year}/${month}/${day}/${encodeURIComponent(post.slug)}/`;
}
