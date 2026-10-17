const POST_FONTS: Record<string, string> = {
  "has-noto-serif-kr-font-family": "var(--yooreru-font-noto-serif-kr)",
  "has-noto-sans-kr-font-family": "var(--yooreru-font-noto-sans-kr)",
  "has-pretendard-font-family": "var(--yooreru-font-pretendard)",
};

export function getPostFontFamily(contentHtml: string) {
  for (const match of contentHtml.matchAll(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    for (const className of (match[1] ?? match[2]).split(/\s+/)) {
      if (Object.hasOwn(POST_FONTS, className)) return POST_FONTS[className];
    }
  }
  return undefined;
}
