// Run: node scripts/check-subscribe-form.mjs
// Exercise the real disclosure with mocked subscription actions; never register emails.
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
sources.subscribe = ts.transpileModule(readFileSync("src/components/subscribe-form.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ hasTouch: true });
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<button id="outside">바깥</button><div id="root" style="margin-top:240px"></div>');
  await page.addStyleTag({ content: readFileSync("src/app/globals.css", "utf8") });
  await page.evaluate((sources) => {
    const modules = {};
    function require(name) {
      if (name === "@/app/actions") return { subscribe: async () => ({ ok: false, message: "테스트 응답" }) };
      if (!modules[name]) {
        const loaded = { exports: {} };
        modules[name] = loaded;
        new Function("require", "module", "exports", "process", sources[name])(
          require, loaded, loaded.exports, { env: { NODE_ENV: "production" } },
        );
      }
      return modules[name].exports;
    }
    require("react-dom/client").createRoot(document.querySelector("#root")).render(
      require("react").createElement(require("subscribe").SubscribeButton),
    );
  }, sources);
  const details = page.locator("details");
  const summary = page.locator("summary");
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await email.fill("reader@example.com");
  await expect(details).toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("테스트 응답")).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(details).toHaveAttribute("open", "");
  await page.locator("#outside").click();
  assert.equal(await details.getAttribute("open"), null);
  await summary.click();
  await summary.click();
  assert.equal(await details.getAttribute("open"), null);
  await summary.press("Enter");
  await expect(details).toHaveAttribute("open", "");
  await email.tap();
  await expect(details).toHaveAttribute("open", "");
  await page.locator("#outside").tap();
  assert.equal(await details.getAttribute("open"), null);
  console.log("Subscription checks passed (outside mouse/touch dismissal, inside editing/submission, confirmation, summary toggle, keyboard).");
} finally {
  await browser.close();
}
