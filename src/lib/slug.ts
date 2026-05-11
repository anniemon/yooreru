export function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function decodeSlug(input: string) {
  let slug = input.trim();

  for (let index = 0; index < 2; index += 1) {
    const decoded = safeDecodeURIComponent(slug);
    if (decoded === slug) {
      break;
    }
    slug = decoded;
  }

  return slug.normalize("NFC");
}

export function normalizeSlug(input: string) {
  return decodeSlug(input)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeExcerpt(input: string, length = 160) {
  const text = input
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= length) {
    return text;
  }

  return `${text.slice(0, length).trim()}...`;
}

export function decodeHtml(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

export function stripHtml(input: string) {
  return decodeHtml(input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

export function cleanCommentContent(input: string) {
  return stripHtml(input.replace(/<!--\s*\/?wp:[\s\S]*?-->/g, " "));
}
