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

async function notifyCommentRecipients({
  post,
  comment,
  parent,
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
  parent: { authorEmail: string | null; content: string } | null;
}) {
  const { year, month, day } = formatDatePathParts(post.publishedAt ?? new Date());
  const href = `${SITE.url}/${year}/${month}/${day}/${encodeURIComponent(post.slug)}/#comments`;
  const type = comment.parentId ? "대댓글" : "댓글";
  const recipients = new Map<string, boolean>();
  if (post.author && !isPostAuthorComment({ ...comment, actorId, postAuthor: post.author })) {
    recipients.set(post.author.email.toLowerCase(), false);
  }
  if (parent?.authorEmail && parent.authorEmail.toLowerCase() !== comment.authorEmail?.toLowerCase()) {
    recipients.set(parent.authorEmail.toLowerCase(), true);
  }

  for (const [email, isReply] of recipients) {
    if (isReply && post.author?.email.toLowerCase() === email &&
      isPostAuthorComment({ ...comment, actorId, postAuthor: post.author })) continue;
    try {
      const result = await sendMail({
        to: email,
        subject: `${SITE.name} ${isReply ? "답글" : type} 알림: ${post.title}`,
        html: [
          `<p><strong>${escapeHtml(comment.authorName)}</strong>님이 <strong>${escapeHtml(post.title)}</strong>${isReply ? "에 남기신 댓글에 답글을" : `에 ${type}을`} 남겼습니다.</p>`,
          ...(isReply && parent ? [
            `<p>내 댓글</p><blockquote>${escapeHtml(parent.content).replace(/\n/g, "<br />")}</blockquote>`,
            "<p>새 답글</p>",
          ] : []),
          `<blockquote>${escapeHtml(comment.content).replace(/\n/g, "<br />")}</blockquote>`,
          `<p><a href="${href}">${isReply ? "답글" : "댓글"} 보러 가기</a></p>`,
        ].join(""),
      });
      if ("error" in result && result.error) throw new Error(result.error.message);
    } catch (error) {
      // 메일 공급자 오류가 댓글 작성 자체를 막지 않도록 한다.
      console.error("[comment-notification] failed", {
        commentId: comment.id,
        postId: post.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
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

  const parent = input.parentId === null ? null : await db.comment.findFirst({
    where: { id: input.parentId, postId: post.id, status: "PUBLISHED" },
    select: { authorEmail: true, content: true },
  });
  if (input.parentId !== null && !parent) {
    throw new Error("답글을 남길 댓글을 찾을 수 없습니다.");
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

  await notifyCommentRecipients({ post, comment, parent, actorId: input.actorId });

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
