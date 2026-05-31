import "server-only";

import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { requirePrisma } from "@/lib/prisma";
import { makeExcerpt, normalizeSlug, stripHtml } from "@/lib/slug";
import { formatDatePathParts, parseDateTimeLocalInTimeZone } from "@/lib/time-zone";
import type { PostStatus } from "@/generated/prisma/enums";

export type SavePostInput = {
  id: number | null;
  title: string;
  slug?: string;
  excerpt?: string;
  contentHtml: string;
  status: PostStatus;
  publishedAt?: string;
  featuredImageUrl?: string;
  allowComments: boolean;
  authorId: number;
  categoryId: number | null;
  tags?: string;
};

function splitTerms(input?: string) {
  return (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePublishedAt(input?: string) {
  if (!input) {
    return new Date();
  }

  const publishedAt = parseDateTimeLocalInTimeZone(input);
  if (!publishedAt) {
    throw new Error("발행일을 확인해 주세요.");
  }

  return publishedAt;
}

async function connectTags(names: string[]) {
  const db = requirePrisma();
  const tags = await Promise.all(
    names.map((name) =>
      db.tag.upsert({
        where: { slug: normalizeSlug(name) || name },
        update: { name },
        create: {
          name,
          slug: normalizeSlug(name) || name,
        },
      }),
    ),
  );

  return tags.map((tag) => ({ id: tag.id }));
}

export async function saveAdminPost(input: SavePostInput) {
  const db = requirePrisma();
  const slug = normalizeSlug(input.slug || input.title);
  const contentText = stripHtml(input.contentHtml);
  const publishedAt = input.status === "DRAFT" ? null : parsePublishedAt(input.publishedAt);
  const categoryId = input.categoryId
    ? (await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))?.id ?? null
    : null;
  const tagConnections = await connectTags(splitTerms(input.tags));
  const postData = {
    title: input.title,
    slug,
    excerpt: input.excerpt || makeExcerpt(input.contentHtml),
    contentHtml: input.contentHtml,
    contentText,
    status: input.status,
    publishedAt,
    featuredImageUrl: input.featuredImageUrl || null,
    allowComments: input.allowComments,
    authorId: input.authorId,
    categoryId,
  };

  return db.$transaction(async (tx) => {
    const savedPost = input.id
      ? await tx.post.update({
          where: { id: input.id },
          data: postData,
        })
      : await tx.post.create({
          data: postData,
        });

    await tx.postTag.deleteMany({ where: { postId: savedPost.id } });
    if (tagConnections.length) {
      await tx.postTag.createMany({
        data: tagConnections.map((tag) => ({
          postId: savedPost.id,
          tagId: tag.id,
        })),
        skipDuplicates: true,
      });
    }

    return savedPost;
  });
}

export async function notifySubscribersForPost(postId: number) {
  const db = requirePrisma();
  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post || post.status !== "PUBLISHED") {
    return;
  }

  const subscribers = await db.subscriber.findMany({ where: { status: "ACTIVE" } });
  const { year, month, day } = formatDatePathParts(post.publishedAt ?? new Date());
  const href = `${SITE.url}/${year}/${month}/${day}/${encodeURIComponent(post.slug)}/`;

  for (const subscriber of subscribers) {
    try {
      const result = await sendMail({
        to: subscriber.email,
        subject: post.title,
        html: `<p><a href="${href}">${post.title}</a></p>${post.contentHtml}`,
      });
      await db.emailDelivery.create({
        data: {
          subscriberId: subscriber.id,
          postId: post.id,
          subject: post.title,
          status: "SENT",
          providerId: "id" in result ? String(result.id) : null,
          sentAt: new Date(),
        },
      });
    } catch (error) {
      await db.emailDelivery.create({
        data: {
          subscriberId: subscriber.id,
          postId: post.id,
          subject: post.title,
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}
