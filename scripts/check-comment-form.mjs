// Run: node scripts/check-comment-form.mjs (requires Playwright Chromium).
// Render the actual React form with delayed actions, without database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { chromium, expect } from "@playwright/test";

const sources = Object.fromEntries([
  ["react", "node_modules/react/cjs/react.production.js"],
  ["react/jsx-runtime", "node_modules/react/cjs/react-jsx-runtime.production.js"],
  ["react-dom", "node_modules/react-dom/cjs/react-dom.production.js"],
  ["react-dom/client", "node_modules/react-dom/cjs/react-dom-client.production.js"],
  ["scheduler", "node_modules/scheduler/cjs/scheduler.production.js"],
].map(([name, path]) => [name, readFileSync(path, "utf8")]));
sources.form = ts.transpileModule(readFileSync("src/components/comment-form.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({ content: readFileSync("src/app/globals.css", "utf8") });
  await page.evaluate((sources) => {
    const modules = {};
    function require(name) {
      if (!modules[name]) {
        const loaded = { exports: {} };
        modules[name] = loaded;
        new Function("require", "module", "exports", "process", sources[name])(
          require, loaded, loaded.exports, { env: { NODE_ENV: "production" } },
        );
      }
      return modules[name].exports;
    }
    const React = require("react");
    const { CommentForm } = require("form");
    window.calls = [];
    const action = (data) => {
      window.calls.push(Object.fromEntries(data));
      return new Promise((resolve) => { window.finish = resolve; });
    };
    require("react-dom/client").createRoot(document.querySelector("#root")).render(
      React.createElement(React.Fragment, null,
        React.createElement(CommentForm, { action }),
        React.createElement(CommentForm, { action, compact: true }),
        React.createElement(CommentForm, { action, compact: true }),
      ),
    );
  }, sources);
  const forms = page.locator("form");
  await expect(forms).toHaveCount(3);
  const ids = await page.locator("input[id], textarea[id]").evaluateAll((nodes) => nodes.map((n) => n.id));
  assert.equal(new Set(ids).size, ids.length, "reply labels must have unique targets");
  for (const index of [0, 1]) {
    const form = forms.nth(index);
    const button = form.locator('button[type="submit"]');
    await expect(button).toBeDisabled();
    await expect(form.locator('[name="authorEmail"]')).toHaveAttribute("placeholder", "Email (입력 시 댓글 알림 발송)");
    await expect(form.locator('[name="authorName"]')).toHaveAttribute("required", "");
    await form.locator('[name="content"]').fill("Test comment…");
    await expect(button).toBeDisabled();
    await form.locator('[name="authorName"]').fill("   ");
    await expect(button).toBeDisabled();
    await form.locator('[name="authorName"]').fill("Tester");
    await expect(button).toBeEnabled();
    assert.equal(await button.evaluate((n) => getComputedStyle(n).color), "rgb(255, 255, 255)");
    await form.locator('[name="authorEmail"]').fill("not-an-email");
    await expect(button).toBeDisabled();
    await form.locator('[name="authorEmail"]').fill("");
    await expect(button).toBeEnabled();
    // Both submits happen before React commits the pending-state render.
    await form.evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    await expect(button).toBeDisabled();
    await expect(button).toHaveText("Submitting…");
    await expect(form).toHaveAttribute("aria-busy", "true");
    assert.equal(await page.evaluate(() => window.calls.length), index + 1);
    assert.equal(await page.evaluate(() => window.calls.at(-1).authorName), "Tester");
    await page.evaluate(() => window.finish());
    await expect(form).toHaveAttribute("aria-busy", "false");
    await expect(form.locator('[name="content"]')).toHaveValue("");
    await expect(button).toBeDisabled();
    await expect(button).toHaveText(index ? "Reply" : "Comment");
  }
  console.log("Comment form checks passed (required/optional fields, blank/invalid input, visible enabled state, pending, rapid duplicate submit, reset, replies, unique labels).");
} finally {
  await browser.close();
}
