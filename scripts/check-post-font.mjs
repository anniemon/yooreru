// Run: node --import tsx scripts/check-post-font.mjs
import assert from "node:assert/strict";
import font from "../src/lib/post-font.ts";

for (const name of ["noto-serif-kr", "noto-sans-kr", "pretendard"]) {
  assert.equal(font.getPostFontFamily(`<p class="has-${name}-font-family">본문</p>`), `var(--yooreru-font-${name})`);
}
assert.equal(font.getPostFontFamily("<p CLASS = 'other has-pretendard-font-family\nhas-small-font-size'>본문</p>"), "var(--yooreru-font-pretendard)");
assert.equal(font.getPostFontFamily('<p class="has-noto-serif-kr-font-family">첫 문단</p><p class="has-pretendard-font-family">둘째</p>'), "var(--yooreru-font-noto-serif-kr)");
for (const html of ["", "<p>기본</p>", '<p class="constructor">기본</p>', '<p data-class="has-pretendard-font-family">기본</p>']) {
  assert.equal(font.getPostFontFamily(html), undefined);
}
console.log("Post title font checks passed (three fonts, saved HTML, default fallback).");
