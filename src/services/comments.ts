import "server-only";

import { getPrisma, requirePrisma } from "@/lib/prisma";
import type { CommentStatus } from "@/generated/prisma/enums";

export type CreateCommentInput = {
  postId: number;
  parentId: number | null;
  authorName: string;
  authorEmail?: string;
  content: string;
};

export async function createPostComment(input: CreateCommentInput) {
  const db = requirePrisma();
  const post = await db.post.findUnique({
    where: { id: input.postId },
  });

  if (!post || !post.allowComments) {
    throw new Error("댓글을 남길 수 없는 게시글입니다.");
  }

  await db.comment.create({
    data: {
      postId: post.id,
      parentId: input.parentId,
      authorName: input.authorName,
      authorEmail: input.authorEmail?.toLowerCase() ?? null,
      content: input.content,
      status: "PUBLISHED",
    },
  });

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
