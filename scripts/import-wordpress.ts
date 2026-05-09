import "dotenv/config";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { put } from "@vercel/blob";
import { XMLParser } from "fast-xml-parser";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { makeExcerpt, normalizeSlug, stripHtml } from "../src/lib/slug";

type AnyRecord = Record<string, any>;

type Attachment = {
  wordpressId?: number;
  url: string;
  title: string;
  filename: string;
  mimeType?: string;
  alt: string;
};

type UploadedMedia = {
  url: string;
  pathname: string;
  filename: string;
  mimeType?: string;
  size: number;
};

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function text(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "object" && "#text" in (value as AnyRecord)) {
    return String((value as AnyRecord)["#text"] ?? "");
  }

  return String(value);
}

function parseWpId(value: unknown) {
  const raw = text(value).trim();
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function postMeta(item: AnyRecord, key: string) {
  return asArray<AnyRecord>(item.postmeta).find((meta) => text(meta.meta_key) === key);
}

function postMetaValue(item: AnyRecord, key: string) {
  return text(postMeta(item, key)?.meta_value);
}

function safeFilename(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-") || "image";
}

function hashValue(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function extensionForContentType(contentType: string) {
  const type = contentType.split(";")[0]?.trim().toLowerCase();
  switch (type) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/avif":
      return ".avif";
    case "image/svg+xml":
      return ".svg";
    default:
      return "";
  }
}

function filenameFromUrl(sourceUrl: string, contentType?: string) {
  let filename = "image";
  try {
    const url = new URL(sourceUrl);
    filename = decodeURIComponent(basename(url.pathname)) || filename;
  } catch {
    // Keep the fallback filename for malformed values.
  }

  const safeName = safeFilename(filename);
  if (extname(safeName) || !contentType) {
    return safeName;
  }

  return `${safeName}${extensionForContentType(contentType)}`;
}

function isMigratableImageUrl(value: string) {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function collectImageUrls(contentHtml: string) {
  const urls = new Set<string>();
  const imgTagPattern = /<img\b[^>]*>/gi;
  const srcPattern = /\bsrc\s*=\s*(["'])(.*?)\1/i;
  const srcsetPattern = /\bsrcset\s*=\s*(["'])(.*?)\1/i;

  for (const [tag] of contentHtml.matchAll(imgTagPattern)) {
    const src = tag.match(srcPattern)?.[2];
    if (src && isMigratableImageUrl(src)) {
      urls.add(src);
    }

    const srcset = tag.match(srcsetPattern)?.[2];
    if (!srcset) {
      continue;
    }

    for (const candidate of srcset.split(",")) {
      const candidateUrl = candidate.trim().split(/\s+/)[0];
      if (candidateUrl && isMigratableImageUrl(candidateUrl)) {
        urls.add(candidateUrl);
      }
    }
  }

  return [...urls];
}

function replaceImageUrls(contentHtml: string, replacements: Map<string, string>) {
  let updated = contentHtml;
  for (const [originalUrl, uploadedUrl] of replacements) {
    updated = updated.split(originalUrl).join(uploadedUrl);
    updated = updated.split(encodeURI(originalUrl)).join(uploadedUrl);
  }

  return updated;
}

async function uploadMediaFromUrl(sourceUrl: string, attachment?: Attachment): Promise<UploadedMedia> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required to import WordPress images into Vercel Blob.");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const mimeType = response.headers.get("content-type") ?? attachment?.mimeType ?? "application/octet-stream";
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Downloaded file is not an image: ${sourceUrl} (${mimeType})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = attachment?.filename || filenameFromUrl(sourceUrl, mimeType);
  const pathname = `wordpress/${attachment?.wordpressId ?? hashValue(sourceUrl)}/${safeFilename(filename)}`;
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31536000,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    filename,
    mimeType,
    size: buffer.byteLength,
  };
}

async function saveMediaAsset(
  prisma: PrismaClient,
  uploaded: UploadedMedia,
  attachment?: Attachment,
) {
  const data = {
    url: uploaded.url,
    pathname: uploaded.pathname,
    filename: uploaded.filename,
    alt: attachment?.alt ?? "",
    mimeType: uploaded.mimeType,
    size: uploaded.size,
  };

  if (attachment?.wordpressId) {
    await prisma.mediaAsset.upsert({
      where: { wordpressId: attachment.wordpressId },
      update: data,
      create: {
        wordpressId: attachment.wordpressId,
        ...data,
      },
    });
    return;
  }

  await prisma.mediaAsset.create({ data });
}

function categoriesFor(item: AnyRecord, domain: "category" | "post_tag") {
  return asArray(item.category)
    .filter((category) => category?.["@_domain"] === domain)
    .map((category) => ({
      name: text(category),
      slug: category["@_nicename"] ? decodeURIComponent(String(category["@_nicename"])) : normalizeSlug(text(category)),
    }))
    .filter((category) => category.name);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const file = process.argv[2];
  if (!file) {
    throw new Error("Usage: npm run wp:import -- ./wordpress-export.xml");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: false,
  });
  const xml = await readFile(file, "utf8");
  const parsed = parser.parse(xml);
  const channel = parsed.rss?.channel ?? parsed.channel;
  const items = asArray<AnyRecord>(channel?.item);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const attachmentsById = new Map<number, Attachment>();
  const attachmentsByUrl = new Map<string, Attachment>();
  const uploadedByOriginalUrl = new Map<string, UploadedMedia>();

  for (const item of items) {
    if (text(item.post_type) !== "attachment") {
      continue;
    }

    const sourceUrl = text(item.attachment_url) || text(item.guid);
    if (!isMigratableImageUrl(sourceUrl)) {
      continue;
    }

    const wordpressId = parseWpId(item.post_id);
    const mimeType = text(item.post_mime_type) || undefined;
    const attachment = {
      wordpressId,
      url: sourceUrl,
      title: text(item.title),
      filename: filenameFromUrl(sourceUrl, mimeType),
      mimeType,
      alt: postMetaValue(item, "_wp_attachment_image_alt"),
    };

    if (wordpressId) {
      attachmentsById.set(wordpressId, attachment);
    }
    attachmentsByUrl.set(sourceUrl, attachment);
  }

  const categoryBySlug = new Map<string, number>();
  const tagBySlug = new Map<string, number>();
  let importedPosts = 0;
  let importedComments = 0;
  let importedMedia = 0;

  for (const item of items) {
    if (text(item.post_type) !== "post" && text(item.post_type) !== "page") {
      continue;
    }

    for (const category of categoriesFor(item, "category")) {
      const saved = await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name },
        create: { name: category.name, slug: category.slug },
      });
      categoryBySlug.set(category.slug, saved.id);
    }

    for (const tag of categoriesFor(item, "post_tag")) {
      const saved = await prisma.tag.upsert({
        where: { slug: tag.slug },
        update: { name: tag.name },
        create: { name: tag.name, slug: tag.slug },
      });
      tagBySlug.set(tag.slug, saved.id);
    }

    const title = text(item.title) || "(untitled)";
    const originalContentHtml = text(item.encoded);
    const imageUrls = collectImageUrls(originalContentHtml);
    const contentImageReplacements = new Map<string, string>();

    for (const imageUrl of imageUrls) {
      const attachment = attachmentsByUrl.get(imageUrl);
      let uploaded = uploadedByOriginalUrl.get(imageUrl);
      if (!uploaded) {
        uploaded = await uploadMediaFromUrl(imageUrl, attachment);
        uploadedByOriginalUrl.set(imageUrl, uploaded);
        await saveMediaAsset(prisma, uploaded, attachment);
        importedMedia += 1;
      }
      contentImageReplacements.set(imageUrl, uploaded.url);
    }

    const thumbnailWpId = parseWpId(postMetaValue(item, "_thumbnail_id"));
    const featuredAttachment = thumbnailWpId ? attachmentsById.get(thumbnailWpId) : undefined;
    let featuredImageUrl: string | null = null;
    if (featuredAttachment) {
      let uploaded = uploadedByOriginalUrl.get(featuredAttachment.url);
      if (!uploaded) {
        uploaded = await uploadMediaFromUrl(featuredAttachment.url, featuredAttachment);
        uploadedByOriginalUrl.set(featuredAttachment.url, uploaded);
        await saveMediaAsset(prisma, uploaded, featuredAttachment);
        importedMedia += 1;
      }
      featuredImageUrl = uploaded.url;
    }

    const contentHtml = replaceImageUrls(originalContentHtml, contentImageReplacements);
    const slug = text(item.post_name) || normalizeSlug(title);
    const status = text(item.status) === "publish" ? "PUBLISHED" : "DRAFT";
    const publishedAt = item.pubDate ? new Date(text(item.pubDate)) : null;
    const categoryId =
      categoriesFor(item, "category")
        .map((category) => categoryBySlug.get(category.slug))
        .find((id): id is number => Boolean(id)) ?? null;
    const tagConnections = categoriesFor(item, "post_tag")
      .map((tag) => tagBySlug.get(tag.slug))
      .filter(Boolean)
      .map((id) => ({ id: id as number }));

    const post = await prisma.post.upsert({
      where: { wordpressId: parseWpId(item.post_id) ?? -1 },
      update: {
        title,
        slug,
        excerpt: text(item.excerpt?.encoded) || makeExcerpt(contentHtml),
        contentHtml,
        contentText: stripHtml(contentHtml),
        permalink: text(item.link) || null,
        status,
        publishedAt,
        featuredImageUrl,
        allowComments: text(item.comment_status) !== "closed",
        categoryId,
      },
      create: {
        wordpressId: parseWpId(item.post_id),
        title,
        slug,
        excerpt: text(item.excerpt?.encoded) || makeExcerpt(contentHtml),
        contentHtml,
        contentText: stripHtml(contentHtml),
        permalink: text(item.link) || null,
        status,
        publishedAt,
        featuredImageUrl,
        allowComments: text(item.comment_status) !== "closed",
        categoryId,
      },
    });

    await prisma.postTag.deleteMany({ where: { postId: post.id } });
    if (tagConnections.length) {
      await prisma.postTag.createMany({
        data: tagConnections.map((tag) => ({
          postId: post.id,
          tagId: tag.id,
        })),
        skipDuplicates: true,
      });
    }

    importedPosts += 1;

    for (const comment of asArray<AnyRecord>(item.comment)) {
      if (!text(comment.comment_content)) {
        continue;
      }

      const wordpressId = parseWpId(comment.comment_id);
      const parentWpId = parseWpId(comment.comment_parent);
      const parent = parentWpId
        ? await prisma.comment.findUnique({ where: { wordpressId: parentWpId } })
        : null;

      await prisma.comment.upsert({
        where: { wordpressId: wordpressId ?? -1 },
        update: {
          content: text(comment.comment_content),
          status: text(comment.comment_approved) === "1" ? "PUBLISHED" : "PENDING",
        },
        create: {
          wordpressId,
          postId: post.id,
          parentId: parent?.id ?? null,
          authorName: text(comment.comment_author) || "anonymous",
          authorEmail: text(comment.comment_author_email) || null,
          content: text(comment.comment_content),
          status: text(comment.comment_approved) === "1" ? "PUBLISHED" : "PENDING",
          createdAt: comment.comment_date_gmt ? new Date(`${text(comment.comment_date_gmt)}Z`) : new Date(),
        },
      });
      importedComments += 1;
    }
  }

  await prisma.$disconnect();
  console.log(`Imported ${importedPosts} posts/pages, ${importedComments} comments, and ${importedMedia} media assets.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
