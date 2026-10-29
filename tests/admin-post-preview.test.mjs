import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies) {
  const source = ts.transpileModule(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", source)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith("react")) return require(name);
    throw new Error(`Unexpected dependency: ${name}`);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

test("admin preview authenticates before reading drafts and renders saved HTML privately", async () => {
  let role = null;
  let reads = 0;
  let post = { id: 42, title: "비공개 초안", contentHtml: '<p class="has-noto-serif-kr-font-family">본문<sup>1</sup></p><section class="yooreru-footnotes"><ol><li>각주</li></ol></section>', author: { id: 3, name: "작성자" }, publishedAt: null };
  const navigation = {
    redirect: (href) => { throw new Error(`redirect:${href}`); },
    notFound: () => { throw new Error("notFound"); },
  };
  const auth = load("lib/auth.ts", {
    "server-only": {}, "jose": { jwtVerify: async () => ({ payload: { id: 1, email: "admin@example.com", role } }) },
    "next/headers": { cookies: async () => ({ get: () => role ? { value: "session" } : undefined }) },
    "next/navigation": navigation, "./constants": { SESSION_COOKIE: "session" },
  });
  const service = load("services/admin-posts.ts", {
    "server-only": {}, "@/lib/constants": {}, "@/lib/mail": {}, "@/lib/slug": {}, "@/lib/time-zone": {},
    "@/lib/prisma": { getPrisma: () => ({ post: { findUnique: async (query) => {
      reads++;
      assert.deepEqual(query.where, { id: 42 });
      assert.deepEqual(query.select.author, { select: { id: true, name: true } });
      return post;
    } } }) },
  });
  const link = { default: ({ children, ...props }) => createElement("a", props, children) };
  const site = { SiteHeader: () => createElement("header", null, "yooreru"), formatWpDate: (date) => date.toISOString() };
  const article = load("components/post-article.tsx", {
    "next/link": link, "@/components/site": site, "@/lib/post-font": load("lib/post-font.ts", {}),
  });
  const preview = load("app/admin/posts/[id]/preview/page.tsx", {
    "next/link": link, "next/navigation": navigation, "@/lib/auth": auth,
    "@/services/admin-posts": service, "@/components/site": site, "@/components/post-article": article,
  });
  const open = (id = "42") => preview.default({ params: Promise.resolve({ id }) });
  for (role of [null, "AUTHOR"]) {
    await assert.rejects(open(), /redirect:\/admin\/login/);
    assert.equal(reads, 0);
  }
  role = "ADMIN";
  for (const id of ["abc", "0", "-1", "1.5", "9007199254740992"]) {
    await assert.rejects(open(id), /notFound/);
  }
  assert.equal(reads, 0);
  const html = renderToStaticMarkup(await open());
  assert.match(html, /비공개 초안/);
  assert.match(html, /yooreru-footnotes/);
  assert.match(html, /var\(--yooreru-font-noto-serif-kr\)/);
  assert.match(html, /href="\/admin\/posts\/42\/edit"/);
  assert.doesNotMatch(html, /<time|<form|post-view|post-subscribe/);
  assert.deepEqual(preview.metadata.robots, { index: false, follow: false });
  post = { ...post, publishedAt: new Date("2026-11-01T00:00:00Z"), author: null };
  assert.match(renderToStaticMarkup(await open()), /<time/);
  assert.match(renderToStaticMarkup(await open()), /작성자 미지정/);
  post = null;
  await assert.rejects(open(), /notFound/);
});

test("admin list opens drafts and scheduled posts through the preview route", async () => {
  const posts = ["DRAFT", "SCHEDULED", "PUBLISHED"].map((status, index) => ({
    id: index + 1, title: status, status, viewCounts: [], _count: { comments: 0 },
  }));
  const page = load("app/admin/page.tsx", {
    "next/link": { default: ({ children, ...props }) => createElement("a", props, children) },
    "@/app/admin/actions": { createInvite: async () => {} },
    "@/components/admin-shell": { AdminShell: ({ children }) => children },
    "@/lib/auth": { requireAdmin: async () => {} },
    "@/services/database": { isDatabaseConfigured: () => true },
    "@/services/admin-posts": { getAdminPostList: async () => posts },
    "@/services/content": { postHref: () => "/published-post/" },
  });
  const html = renderToStaticMarkup(await page.default());
  assert.match(html, /href="\/admin\/posts\/1\/preview">DRAFT/);
  assert.match(html, /href="\/admin\/posts\/2\/preview">SCHEDULED/);
  assert.match(html, /href="\/published-post\/">PUBLISHED/);
});
