import "server-only";

import { SITE } from "@/lib/constants";
import { sendMail } from "@/lib/mail";
import { getPrisma, requirePrisma } from "@/lib/prisma";
import { formatDatePathParts } from "@/lib/time-zone";
import type { CommentStatus } from "@/generated/prisma/enums";

export type CreateCommentInput = {
  postId: number;
  parentId: number | null;
  authorName: string;
  authorEmail?: string;
  content: string;
  actorId?: number | null;
};

const HTML_ESCAPE_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPE_ENTITIES[character]);
}

function isPostAuthorComment({
  actorId,
  authorEmail,
  postAuthor,
}: {
  actorId?: number | null;
  authorEmail: string | null;
  postAuthor: { id: number; email: string };
}) {
  return actorId === postAuthor.id || authorEmail?.toLocaleLowerCase() === postAuthor.email.toLocaleLowerCase();
}

async function notifyPostAuthorOfComment({
  post,
  comment,
  actorId,
}: {
  post: {
    id: number;
    title: string;
    slug: string;
    publishedAt: Date | null;
    author: { id: number; email: string } | null;
  };
  comment: {
    id: number;
    parentId: number | null;
    authorName: string;
    authorEmail: string | null;
    content: string;
  };
  actorId?: number | null;
}) {
  if (!post.author || isPostAuthorComment({ ...comment, actorId, postAuthor: post.author })) {
    return;
  }

  const { year, month, day } = formatDatePathParts(post.publishedAt ?? new Date());
  const href = `${SITE.url}/${year}/${month}/${day}/${encodeURIComponent(post.slug)}/#comments`;
  const type = comment.parentId ? "대댓글" : "댓글";

  try {
    await sendMail({
      to: post.author.email,
      subject: `${SITE.name} ${type} 알림: ${post.title}`,
      html: [
        `<p><strong>${escapeHtml(comment.authorName)}</strong>님이 <strong>${escapeHtml(post.title)}</strong>에 ${type}을 남겼습니다.</p>`,
        `<blockquote>${escapeHtml(comment.content).replace(/\n/g, "<br />")}</blockquote>`,
        `<p><a href="${href}">댓글 보러 가기</a></p>`,
      ].join(""),
    });
  } catch (error) {
    // 메일 공급자 오류가 댓글 작성 자체를 막지 않도록 한다.
    console.error("[comment-notification] failed", {
      commentId: comment.id,
      postId: post.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function createPostComment(input: CreateCommentInput) {
  const db = requirePrisma();
  const post = await db.post.findUnique({
    where: { id: input.postId },
    include: { author: { select: { id: true, email: true } } },
  });

  if (!post || !post.allowComments) {
    throw new Error("댓글을 남길 수 없는 게시글입니다.");
  }

  const comment = await db.comment.create({
    data: {
      postId: post.id,
      parentId: input.parentId,
      authorName: input.authorName,
      authorEmail: input.authorEmail?.toLowerCase() ?? null,
      content: input.content,
      status: "PUBLISHED",
    },
  });

  await notifyPostAuthorOfComment({ post, comment, actorId: input.actorId });

  return post;
}

export async function getAdminComments() {
  const db = getPrisma();
  if (!db) {
    return [];
  }

  return db.comment.findMany({
    orderBy: { createdAt: "desc" },
    include: { post: { select: { title: true } } },
    take: 100,
  });
}

export async function moderatePostComment(id: number, status: CommentStatus) {
  const db = requirePrisma();
  await db.comment.update({
    where: { id },
    data: { status },
  });
}
