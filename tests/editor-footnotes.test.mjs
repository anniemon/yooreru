import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import ts from "typescript";

test("footnotes preserve text, round-trip HTML, renumber, and escape content", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("http://localhost/", (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: '<div id="editor" contenteditable="true"><p>앞 중간 뒤</p></div>' }));
    await page.goto("http://localhost/");
    const source = ts.transpileModule(readFileSync(new URL("../src/lib/editor-footnotes.ts", import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    await page.addScriptTag({ content: `const exports = {}; ${source}` });
    const result = await page.evaluate(() => {
      const editor = document.querySelector("#editor");
      const { insertFootnote, normalizeFootnotes } = exports;
      const range = document.createRange();
      range.setStart(editor.firstChild.firstChild, 2);
      range.setEnd(editor.firstChild.firstChild, 4);
      insertFootnote(editor, range, '<img src=x onerror="alert(1)"> & 설명\n두 번째 줄');
      const secondRange = document.createRange();
      secondRange.setStart(editor.firstChild.firstChild, 0);
      secondRange.collapse(true);
      insertFootnote(editor, secondRange, "앞쪽 각주");
      const before = {
        text: editor.firstChild.textContent,
        notes: Array.from(editor.querySelectorAll("li span"), (node) => node.textContent),
        imageCount: editor.querySelectorAll("img").length,
        linksMatch: Array.from(editor.querySelectorAll("sup a"), (link) => Boolean(editor.querySelector(link.getAttribute("href")))),
      };
      const html = editor.innerHTML;
      editor.innerHTML = html;
      normalizeFootnotes(editor);
      const roundTrip = editor.innerHTML === html;
      const noteRange = document.createRange();
      noteRange.selectNodeContents(editor.querySelector("li span"));
      const rejectedNested = insertFootnote(editor, noteRange, "중첩 각주") === null;
      editor.querySelector("sup").remove();
      normalizeFootnotes(editor);
      const after = { count: editor.querySelectorAll("li").length, number: editor.querySelector("sup a").textContent };
      const stable = editor.innerHTML;
      normalizeFootnotes(editor);
      const idempotent = stable === editor.innerHTML;
      editor.querySelector("sup").remove();
      normalizeFootnotes(editor);
      const cleaned = !editor.querySelector(".yooreru-footnotes");
      insertFootnote(editor, null, "커서 없이 추가");
      return { before, roundTrip, rejectedNested, after, idempotent, cleaned, fallback: editor.querySelector("li span").textContent };
    });
    assert.equal(result.before.text, "1앞 중간2 뒤");
    assert.deepEqual(result.before.notes, ["앞쪽 각주", '<img src=x onerror="alert(1)"> & 설명\n두 번째 줄']);
    assert.equal(result.before.imageCount, 0);
    assert.deepEqual(result.before.linksMatch, [true, true]);
    assert.equal(result.roundTrip, true);
    assert.equal(result.rejectedNested, true);
    assert.deepEqual(result.after, { count: 1, number: "1" });
    assert.equal(result.idempotent, true);
    assert.equal(result.cleaned, true);
    assert.equal(result.fallback, "커서 없이 추가");
  } finally {
    await browser.close();
  }
});
