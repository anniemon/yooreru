import "dotenv/config";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { put } from "@vercel/blob";
import { XMLParser } from "fast-xml-parser";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { cleanCommentContent, makeExcerpt, normalizeSlug, stripHtml } from "../src/lib/slug";
import bcrypt from "bcryptjs";
import sharp from "sharp";

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

type WpTerm = {
  wordpressId?: number;
  name: string;
  slug: string;
  description: string;
  parentSlug?: string;
};

type WpAuthor = {
  login: string;
  email: string;
  displayName: string;
};

const BLOG_IMAGE_MAX_DIMENSION = 1600;
const BLOG_IMAGE_WEBP_QUALITY = 82;

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
  const type = normalizedContentType(contentType);
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

function normalizedContentType(contentType: string) {
  return contentType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
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

function filenameWithExtension(filename: string, extension: string) {
  const currentExtension = extname(filename);
  if (!currentExtension) {
    return `${filename}${extension}`;
  }

  return `${filename.slice(0, -currentExtension.length)}${extension}`;
}

function isOptimizableImage(contentType: string) {
  return ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(normalizedContentType(contentType));
}

async function optimizeImageForBlog(input: Buffer, mimeType: string, filename: string) {
  if (!isOptimizableImage(mimeType)) {
    return {
      buffer: input,
      mimeType: normalizedContentType(mimeType),
      filename,
    };
  }

  const optimized = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: BLOG_IMAGE_MAX_DIMENSION,
      height: BLOG_IMAGE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: BLOG_IMAGE_WEBP_QUALITY,
      effort: 4,
    })
    .toBuffer();

  if (optimized.byteLength >= input.byteLength) {
    return {
      buffer: input,
      mimeType: normalizedContentType(mimeType),
      filename,
    };
  }

  return {
    buffer: optimized,
    mimeType: "image/webp",
    filename: filenameWithExtension(filename, ".webp"),
  };
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

  const downloadedMimeType = response.headers.get("content-type") ?? attachment?.mimeType ?? "application/octet-stream";
  const normalizedMimeType = normalizedContentType(downloadedMimeType);
  if (!normalizedMimeType.startsWith("image/")) {
    throw new Error(`Downloaded file is not an image: ${sourceUrl} (${downloadedMimeType})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const originalFilename = attachment?.filename || filenameFromUrl(sourceUrl, normalizedMimeType);
  const optimized = await optimizeImageForBlog(buffer, normalizedMimeType, originalFilename);
  const pathname = `wordpress/${attachment?.wordpressId ?? hashValue(sourceUrl)}/${safeFilename(optimized.filename)}`;
  const blob = await put(pathname, optimized.buffer, {
    access: "public",
    contentType: optimized.mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31536000,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    filename: optimized.filename,
    mimeType: optimized.mimeType,
    size: optimized.buffer.byteLength,
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

function termsForChannel(channel: AnyRecord, key: "category" | "tag"): WpTerm[] {
  return asArray<AnyRecord>(channel[key])
    .filter((term) => term.term_id || term.category_nicename || term.tag_slug)
    .map((term) => {
      const rawSlug = key === "category" ? text(term.category_nicename) : text(term.tag_slug);
      const rawParentSlug = key === "category" ? text(term.category_parent) : "";
      return {
        wordpressId: parseWpId(term.term_id),
        name: text(term.cat_name || term.tag_name),
        slug: rawSlug ? decodeURIComponent(rawSlug) : normalizeSlug(text(term.cat_name || term.tag_name)),
        description: text(term.category_description || term.tag_description),
        parentSlug: rawParentSlug ? decodeURIComponent(rawParentSlug) : undefined,
      };
    })
    .filter((term) => term.name && term.slug);
}

function authorsForChannel(channel: AnyRecord): WpAuthor[] {
  return asArray<AnyRecord>(channel?.author)
    .map((author) => {
      const login = text(author.author_login).trim();
      return {
        login,
        email: text(author.author_email).trim() || `${login || "wordpress-author"}@wordpress.local`,
        displayName: text(author.author_display_name).trim() || login,
      };
    })
    .filter((author) => author.login && author.email);
}

function categoryDepth(slug: string, categoryBySlug: Map<string, WpTerm>) {
  let depth = 0;
  let current = categoryBySlug.get(slug);
  const visited = new Set<string>();

  while (current?.parentSlug && !visited.has(current.parentSlug)) {
    visited.add(current.parentSlug);
    depth += 1;
    current = categoryBySlug.get(current.parentSlug);
  }

  return depth;
}

function primaryCategoryForPost(categories: Array<Pick<WpTerm, "slug">>, categoryTermsBySlug: Map<string, WpTerm>) {
  return categories.toSorted(
    (left, right) => categoryDepth(right.slug, categoryTermsBySlug) - categoryDepth(left.slug, categoryTermsBySlug),
  )[0];
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
  const categoryTerms = termsForChannel(channel, "category");
  const tagTerms = termsForChannel(channel, "tag");
  const authors = authorsForChannel(channel);
  const categoryTermsBySlug = new Map(categoryTerms.map((category) => [category.slug, category]));

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
  const authorByLogin = new Map<string, number>();
  let importedPosts = 0;
  let importedComments = 0;
  let importedMedia = 0;

  const importedAuthorPasswordHash = await bcrypt.hash(hashValue(`wordpress-import:${file}`), 12);

  for (const author of authors) {
    const saved = await prisma.user.upsert({
      where: { email: author.email },
      update: {
        name: author.displayName,
      },
      create: {
        email: author.email,
        name: author.displayName,
        role: "AUTHOR",
        passwordHash: importedAuthorPasswordHash,
      },
    });
    authorByLogin.set(author.login, saved.id);
  }

  for (const category of categoryTerms) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        wordpressId: category.wordpressId,
        name: category.name,
        description: category.description,
      },
      create: {
        wordpressId: category.wordpressId,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    });
    categoryBySlug.set(category.slug, saved.id);
  }

  for (const category of categoryTerms) {
    const categoryId = categoryBySlug.get(category.slug);
    if (!categoryId) {
      continue;
    }

    await prisma.category.update({
      where: { id: categoryId },
      data: {
        parentId: category.parentSlug ? categoryBySlug.get(category.parentSlug) ?? null : null,
      },
    });
  }

  for (const tag of tagTerms) {
    const saved = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        wordpressId: tag.wordpressId,
        name: tag.name,
        description: tag.description,
      },
      create: {
        wordpressId: tag.wordpressId,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
      },
    });
    tagBySlug.set(tag.slug, saved.id);
  }

  for (const item of items) {
    if (text(item.post_type) !== "post" && text(item.post_type) !== "page") {
      continue;
    }

    for (const category of categoriesFor(item, "category")) {
      if (categoryBySlug.has(category.slug)) {
        continue;
      }

      const saved = await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name },
        create: { name: category.name, slug: category.slug },
      });
      categoryBySlug.set(category.slug, saved.id);
    }

    for (const tag of categoriesFor(item, "post_tag")) {
      if (tagBySlug.has(tag.slug)) {
        continue;
      }

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
    const slug = normalizeSlug(text(item.post_name) || title);
    const status = text(item.status) === "publish" ? "PUBLISHED" : "DRAFT";
    const publishedAt = item.pubDate ? new Date(text(item.pubDate)) : null;
    const primaryCategory = primaryCategoryForPost(categoriesFor(item, "category"), categoryTermsBySlug);
    const categoryId = primaryCategory ? categoryBySlug.get(primaryCategory.slug) ?? null : null;
    const authorId = authorByLogin.get(text(item.creator).trim()) ?? null;
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
        authorId,
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
        authorId,
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

      const commentContent = cleanCommentContent(text(comment.comment_content));

      await prisma.comment.upsert({
        where: { wordpressId: wordpressId ?? -1 },
        update: {
          content: commentContent,
          status: text(comment.comment_approved) === "1" ? "PUBLISHED" : "PENDING",
        },
        create: {
          wordpressId,
          postId: post.id,
          parentId: parent?.id ?? null,
          authorName: text(comment.comment_author) || "anonymous",
          authorEmail: text(comment.comment_author_email) || null,
          content: commentContent,
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
