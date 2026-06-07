import "server-only";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { requirePrisma } from "@/lib/prisma";
import { getZonedCalendarParts } from "@/lib/time-zone";

const MAX_EDITOR_IMAGE_SIZE = 8 * 1024 * 1024;

export async function uploadAdminEditorImage(file: File) {
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
