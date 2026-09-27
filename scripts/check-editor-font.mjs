// Run: node scripts/check-editor-font.mjs (requires Playwright Chromium).
// Run the real editor handler against browser DOM, without server/database access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { chromium } from "@playwright/test";

const source = ts.transpileModule(readFileSync("src/components/admin-post-form.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<div class="admin-rich-editor" contenteditable></div><input id="saved">');
  await page.addStyleTag({ content: readFileSync("src/app/globals.css", "utf8") });
  const result = await page.evaluate((source) => {
    const jsx = (type, props) => ({ type, props });
    const hooks = {
      useRef: (current) => ({ current }), useState: (v) => [v, () => {}],
      useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect() {},
    };
    const exports = {};
    new Function("require", "exports", source)((name) => {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/lib/time-zone") return { formatDateTimeLocal: () => "" };
      return {};
    }, exports);
    const original = '<p class="has-noto-serif-kr-font-family"><span style="font-family:serif;color:red" class="has-large-font-size">첫 문단</span></p><p><font face="serif">둘째</font> <a href="/example">링크</a></p><figure><img src="/photo" alt="사진"></figure>직접 입력';
    const tree = exports.AdminPostForm({ post: { contentHtml: original }, categories: [], timeZone: "Asia/Seoul" });
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      const children = node.props?.children;
      (Array.isArray(children) ? children.flat(Infinity) : [children]).forEach(visit);
    }
    visit(tree);
    const editor = document.querySelector(".admin-rich-editor");
    const saved = document.querySelector("#saved");
    nodes.find((n) => n.props?.name === "contentHtml").props.ref.current = saved;
    nodes.find((n) => n.props?.contentEditable).props.ref(editor);
    const select = nodes.find((n) => n.props?.["aria-label"] === "본문 글꼴");
    const fonts = [];
    const labels = [];
    for (const choice of ["has-noto-sans-kr-font-family", "has-pretendard-font-family", ""]) {
      window.getSelection().removeAllRanges();
      const input = { value: choice };
      select.props.onChange({ currentTarget: input });
      labels.push(input.value);
      fonts.push([...editor.querySelectorAll("p, span, font, a")].map((n) => getComputedStyle(n).fontFamily));
      if (saved.value !== editor.innerHTML) throw new Error("Saved HTML is out of sync");
    }
    return { fonts, labels, html: saved.value, text: editor.textContent };
  }, source);
  assert.ok(result.fonts[0].every((font) => font.includes("Noto Sans KR")));
  assert.ok(result.fonts[1].every((font) => font.includes("Pretendard")));
  assert.ok(result.fonts[2].every((font) => !/Pretendard|Noto/.test(font)));
  assert.deepEqual(result.labels, ["has-noto-sans-kr-font-family", "has-pretendard-font-family", ""]);
  assert.match(result.html, /has-large-font-size/);
  assert.match(result.html, /color:\s*red/);
  assert.match(result.html, /href="\/example"/);
  assert.match(result.html, /alt="사진"/);
  assert.equal(result.text, "첫 문단둘째 링크직접 입력");
  console.log("Editor font checks passed (whole body, nested fonts, reset, saved HTML, preserved formatting).");
} finally {
  await browser.close();
}
