// Run: node scripts/check-editor-paste.mjs (requires Playwright Chromium).
// Exercise the real paste handler and undo history without database access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { chromium } from "@playwright/test";

const source = ts.transpileModule(readFileSync("src/components/admin-post-form.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ permissions: ["clipboard-read", "clipboard-write"] });
  await page.route("**/*", (route) => route.fulfill({
    contentType: "text/html",
    body: '<div class="admin-rich-editor" contenteditable></div><input type="hidden" id="saved"><div class="entry-content wp-block-post-content"></div>',
  }));
  await page.goto("http://localhost:3219");
  await page.addStyleTag({ content: readFileSync("src/app/globals.css", "utf8") });
  await page.evaluate((source) => {
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
    const tree = exports.AdminPostForm({ categories: [], timeZone: "Asia/Seoul" });
    const nodes = [];
    function visit(node) {
      if (!node || typeof node !== "object") return;
      nodes.push(node);
      const children = node.props?.children;
      (Array.isArray(children) ? children.flat(Infinity) : [children]).forEach(visit);
    }
    visit(tree);
    const props = nodes.find((n) => n.props?.contentEditable).props;
    const editor = document.querySelector(".admin-rich-editor");
    nodes.find((n) => n.props?.name === "contentHtml").props.ref.current = document.querySelector("#saved");
    props.ref(editor);
    editor.addEventListener("paste", props.onPaste);
    editor.addEventListener("input", props.onInput);
    window.testImagePaste = () => {
      let prevented = false;
      props.onPaste({ clipboardData: { getData: () => "" }, preventDefault: () => { prevented = true; } });
      return prevented;
    };
  }, source);
  const text = '  시작··· … ⋯  두 칸\t탭\u00a0NBSP\n\n 다음 <script>alert(1)</script> & "끝"  \n';
  for (const rich of [false, true]) {
    await page.evaluate(async ({ text, rich }) => {
      const editor = document.querySelector(".admin-rich-editor");
      editor.innerHTML = '<p class="has-noto-sans-kr-font-family">앞 TARGET 뒤</p>';
      editor.focus();
      const range = document.createRange();
      range.setStart(editor.firstChild.firstChild, 2);
      range.setEnd(editor.firstChild.firstChild, 8);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      const data = { "text/plain": new Blob([text], { type: "text/plain" }) };
      if (rich) data["text/html"] = new Blob(['<p style="color:red">wrong format</p>'], { type: "text/html" });
      await navigator.clipboard.write([new ClipboardItem(data)]);
    }, { text, rich });
    await page.keyboard.press(process.platform === "darwin" ? "Meta+V" : "Control+V");
    const result = await page.evaluate(() => {
      const editor = document.querySelector(".admin-rich-editor");
      document.querySelector(".entry-content").innerHTML = document.querySelector("#saved").value;
      const span = document.querySelector(".entry-content span");
      return {
        pastedText: span?.textContent, text: editor.textContent, saved: document.querySelector("#saved").value,
        publicText: document.querySelector(".entry-content").textContent,
        whiteSpace: span && getComputedStyle(span).whiteSpace,
        scripts: editor.querySelectorAll("script").length,
      };
    });
    assert.equal(result.pastedText, text);
    assert.equal(result.text.replace(/\u00a0/g, " "), `앞 ${text} 뒤`.replace(/\u00a0/g, " "));
    assert.equal(result.publicText, result.text);
    assert.equal(result.whiteSpace, "pre-wrap");
    assert.equal(result.scripts, 0);
    assert.match(result.saved, /has-noto-sans-kr-font-family/);
    assert.doesNotMatch(result.saved, /color:\s*red|wrong format/);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Z" : "Control+Z");
    assert.equal(await page.locator(".admin-rich-editor").textContent(), "앞 TARGET 뒤");
  }
  assert.equal(await page.evaluate(() => window.testImagePaste()), false);
  console.log("Editor paste checks passed (plain/rich clipboard, whitespace, symbols, selection, saved/public HTML, escaping, undo, image fallback).");
} finally {
  await browser.close();
}
