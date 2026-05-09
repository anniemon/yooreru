export function normalizeSlug(input: string) {
  return input
    .trim()
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
