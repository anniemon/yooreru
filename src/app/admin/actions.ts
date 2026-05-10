"use server";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { put } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { CONTENT_CACHE_TAG } from "@/lib/content";
import { sendMail } from "@/lib/mail";
import { requirePrisma } from "@/lib/prisma";
import { makeExcerpt, normalizeSlug, stripHtml } from "@/lib/slug";
import { formatDatePathParts, getZonedCalendarParts, parseDateTimeLocalInTimeZone } from "@/lib/time-zone";

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

const MAX_EDITOR_IMAGE_SIZE = 8 * 1024 * 1024;

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["ADMIN", "AUTHOR"]),
});

function splitTerms(input?: string) {
  return (input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

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

async function notifySubscribers(postId: number) {
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

  const db = requirePrisma();
  const data = parsed.data;
  const slug = normalizeSlug(data.slug || data.title);
  const contentText = stripHtml(data.contentHtml);
  const publishedAt =
    data.status === "DRAFT"
      ? null
      : parsePublishedAt(data.publishedAt);
  const selectedCategoryId = parseSubmittedOptionalId(data.categoryId, "카테고리를 확인해 주세요.");
  const categoryId = selectedCategoryId
    ? (await db.category.findUnique({ where: { id: selectedCategoryId }, select: { id: true } }))?.id ?? null
    : null;
  const tagConnections = await connectTags(splitTerms(data.tags));
  const postData = {
    title: data.title,
    slug,
    excerpt: data.excerpt || makeExcerpt(data.contentHtml),
    contentHtml: data.contentHtml,
    contentText,
    status: data.status,
    publishedAt,
    featuredImageUrl: data.featuredImageUrl || null,
    allowComments: data.allowComments === "on",
    authorId: user.id,
    categoryId,
  };
  const postId = parseSubmittedOptionalId(data.id, "게시글을 확인해 주세요.");

  const post = await db.$transaction(async (tx) => {
    const savedPost = postId
      ? await tx.post.update({
          where: { id: postId },
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

  // todo: 별도 job으로 분리
  if (data.notifySubscribers === "on" && data.status === "PUBLISHED") {
    await notifySubscribers(post.id);
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

  const db = requirePrisma();
  const data = parsed.data;
  const slug = normalizeSlug(data.slug || data.name) || data.name;
  const categoryId = parseSubmittedOptionalId(data.id, "카테고리를 확인해 주세요.");
  const parsedParentId = parseSubmittedOptionalId(data.parentId, "상위 카테고리를 확인해 주세요.");
  const parentId = parsedParentId && parsedParentId !== categoryId ? parsedParentId : null;

  if (categoryId) {
    await db.category.update({
      where: { id: categoryId },
      data: {
        name: data.name,
        slug,
        description: data.description ?? "",
        parentId,
      },
    });
  } else {
    await db.category.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? "",
        parentId,
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/admin/categories");
  revalidateTag(CONTENT_CACHE_TAG, "max");
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  await requireAdmin();
  const id = parseRequiredId(formData.get("id"), "삭제할 카테고리를 확인해 주세요.");

  const db = requirePrisma();
  await db.category.delete({ where: { id } });
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

  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  if (file.size > MAX_EDITOR_IMAGE_SIZE) {
    throw new Error("이미지는 8MB 이하만 업로드할 수 있습니다.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN이 설정되어야 이미지 업로드를 사용할 수 있습니다.");
  }

  const db = requirePrisma();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-") || "image";
  const pathname = `editor/${getZonedCalendarParts(new Date()).year}/${randomUUID()}-${safeName}`;
  const blob = await put(pathname, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
  });

  await db.mediaAsset.create({
    data: {
      url: blob.url,
      pathname: blob.pathname,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    },
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    filename: file.name,
  };
}

export async function createInvite(formData: FormData) {
  const user = await requireAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error("초대 정보를 확인해 주세요.");
  }

  const db = requirePrisma();
  const token = randomUUID();
  const invite = await db.invite.create({
    data: {
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });

  await sendMail({
    to: invite.email,
    subject: `${SITE.name} 관리자 초대`,
    html: `<p>관리자 초대가 생성되었습니다.</p><p><a href="${SITE.url}/admin/invite/${invite.token}">초대 수락</a></p>`,
  });

  revalidatePath("/admin");
}

export async function acceptInvite(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (password.length < 8 || !name) {
    throw new Error("이름과 8자 이상의 비밀번호가 필요합니다.");
  }

  const db = requirePrisma();
  const invite = await db.invite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("유효하지 않은 초대입니다.");
  }

  const user = await db.user.create({
    data: {
      email: invite.email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: invite.role,
    },
  });

  await db.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/admin");
}
