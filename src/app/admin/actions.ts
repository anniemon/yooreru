"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { CONTENT_CACHE_TAG } from "@/lib/content";
import { requirePrisma } from "@/lib/prisma";
import { deleteAdminCategory, saveAdminCategory } from "@/services/admin-categories";
import { acceptAdminInvite, createAdminInvite } from "@/services/admin-invites";
import { uploadAdminEditorImage } from "@/services/admin-media";
import { notifySubscribersForPost, saveAdminPost } from "@/services/admin-posts";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const postSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(220),
  slug: z.string().trim().optional(),
  excerpt: z.string().trim().optional(),
  contentHtml: z.string().trim().min(1),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]),
  publishedAt: z.string().optional(),
  featuredImageUrl: z.string().trim().url().optional().or(z.literal("")),
  allowComments: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.string().optional(),
  notifySubscribers: z.string().optional(),
});

const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  parentId: z.string().optional(),
});

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "AUTHOR"]),
});

function parseOptionalId(input?: string | null) {
  if (!input) {
    return null;
  }

  const id = Number(input);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseRequiredId(input: FormDataEntryValue | null, message: string) {
  const id = parseOptionalId(typeof input === "string" ? input : null);
  if (!id) {
    throw new Error(message);
  }

  return id;
}

function parseSubmittedOptionalId(input: string | undefined, message: string) {
  if (!input) {
    return null;
  }

  const id = parseOptionalId(input);
  if (!id) {
    throw new Error(message);
  }

  return id;
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("로그인 정보를 확인해 주세요.");
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    throw new Error("로그인 정보를 확인해 주세요.");
  }

  await createSession(user);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

export async function savePost(formData: FormData) {
  const user = await requireAdmin();
  const parsed = postSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("게시글 입력값을 확인해 주세요.");
  }

  const data = parsed.data;
  const selectedCategoryId = parseSubmittedOptionalId(data.categoryId, "카테고리를 확인해 주세요.");
  const postId = parseSubmittedOptionalId(data.id, "게시글을 확인해 주세요.");

  const post = await saveAdminPost({
    id: postId,
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    contentHtml: data.contentHtml,
    status: data.status,
    publishedAt: data.publishedAt,
    featuredImageUrl: data.featuredImageUrl,
    allowComments: data.allowComments === "on",
    authorId: user.id,
    categoryId: selectedCategoryId,
    tags: data.tags,
  });

  // todo: 별도 job으로 분리
  if (data.notifySubscribers === "on" && data.status === "PUBLISHED") {
    await notifySubscribersForPost(post.id);
  }

  revalidatePath("/");
  revalidateTag(CONTENT_CACHE_TAG, "max");
  redirect("/admin");
}

export async function moderateComment(formData: FormData) {
  await requireAdmin();
  const id = parseRequiredId(formData.get("id"), "댓글을 확인해 주세요.");
  const status = String(formData.get("status") ?? "");

  if (!["PUBLISHED", "HIDDEN", "SPAM", "PENDING"].includes(status)) {
    throw new Error("댓글 상태를 확인해 주세요.");
  }

  const db = requirePrisma();
  await db.comment.update({
    where: { id },
    data: { status: status as "PUBLISHED" | "HIDDEN" | "SPAM" | "PENDING" },
  });

  revalidatePath("/admin/comments");
}

export async function saveCategory(formData: FormData) {
  await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("카테고리 입력값을 확인해 주세요.");
  }

  const data = parsed.data;
  const categoryId = parseSubmittedOptionalId(data.id, "카테고리를 확인해 주세요.");
  const parsedParentId = parseSubmittedOptionalId(data.parentId, "상위 카테고리를 확인해 주세요.");
  await saveAdminCategory({
    id: categoryId,
    name: data.name,
    slug: data.slug,
    description: data.description,
    parentId: parsedParentId,
  });

  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidateTag(CONTENT_CACHE_TAG, "max");
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = parseRequiredId(formData.get("id"), "삭제할 카테고리를 확인해 주세요.");

  await deleteAdminCategory(id);
  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidateTag(CONTENT_CACHE_TAG, "max");
  redirect("/admin/categories");
}

export async function uploadEditorImage(formData: FormData) {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("업로드할 이미지 파일을 선택해 주세요.");
  }

  return uploadAdminEditorImage(file);
}

export async function createInvite(formData: FormData) {
  const user = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("초대 정보를 확인해 주세요.");
  }

  await createAdminInvite({
    email: parsed.data.email,
    role: parsed.data.role,
    invitedById: user.id,
  });

  revalidatePath("/admin");
}

export async function acceptInvite(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (password.length < 8 || !name) {
    throw new Error("이름과 8자 이상의 비밀번호가 필요합니다.");
  }

  const user = await acceptAdminInvite({ token, name, password });

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/admin");
}
