"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SITE } from "@/lib/constants";
import { postHref } from "@/lib/content";
import { createPostComment } from "@/services/comments";
import { saveContactMessage } from "@/services/contact";
import { subscribeEmail } from "@/services/subscribers";

const commentSchema = z.object({
  authorName: z.string().trim().min(1).max(80),
  authorEmail: z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const email = value.trim();
    return email || undefined;
  }, z.string().email().max(160).optional()),
  content: z.string().trim().min(1).max(4000),
  // 스팸 봇 방지용 필드
  company: z.string().optional(),
});

const subscribeSchema = z.object({
  email: z.string().trim().email().max(180),
});

export type SubscribeState = {
  ok: boolean;
  message: string;
};

const contactSchema = z.object({
  senderName: z.string().trim().min(1).max(80),
  senderEmail: z.preprocess((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const email = value.trim();
    return email || undefined;
  }, z.string().email().max(160).optional()),
  message: z.string().trim().min(1).max(4000),
  company: z.string().optional(),
});

export async function createComment(postId: number, parentId: number | null, formData: FormData) {
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("댓글 입력값을 확인해 주세요.");
  }

  if (parsed.data.company) {
    return;
  }

  const post = await createPostComment({
    postId,
    parentId,
    authorName: parsed.data.authorName,
    authorEmail: parsed.data.authorEmail,
    content: parsed.data.content,
  });

  const href = postHref({
    slug: post.slug,
    publishedAt: post.publishedAt,
  });
  revalidatePath(href);
  redirect(`${href}#comments`);
}

export async function subscribe(_state: SubscribeState, formData: FormData): Promise<SubscribeState> {
  const parsed = subscribeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "이메일 주소를 확인해 주세요." };
  }

  const result = await subscribeEmail(parsed.data.email.toLowerCase());

  // Next.js 캐시 무효화
  revalidatePath("/");
  return {
    ok: true,
    message: result.alreadySubscribed ? "이미 구독 중입니다." : "구독이 등록되었습니다.",
  };
}

export async function sendContactMessage(formData: FormData) {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("메시지 입력값을 확인해 주세요.");
  }

  if (parsed.data.company) {
    return;
  }

  await saveContactMessage(parsed.data);

  redirect(`${encodeURI(SITE.contactPath)}?sent=1`);
}
