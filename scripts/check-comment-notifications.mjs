// Run: node scripts/check-comment-notifications.mjs
// Mock database and mail boundaries; never send email or write to a database.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/services/comments.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function run({ parent = null, parentId = null, email = "visitor@example.com", actorId, failedMail = false } = {}) {
  const mails = [];
  const errors = [];
  let writes = 0;
  const post = {
    id: 1, title: "손을 흔들었다", slug: "손을-흔들었다", publishedAt: new Date("2026-10-17T00:00:00Z"),
    allowComments: true, author: { id: 2, email: "author@example.com" },
  };
  const db = {
    post: { findUnique: async () => post },
    comment: {
      findFirst: async (query) => {
        assert.deepEqual(query.where, { id: parentId, postId: 1, status: "PUBLISHED" });
        return parent;
      },
      create: async ({ data }) => { writes++; return { ...data, id: 20 }; },
    },
  };
  const exports = {};
  new Function("require", "exports", "console", source)((name) => {
    if (name === "server-only") return {};
    if (name === "@/lib/prisma") return { requirePrisma: () => db };
    if (name === "@/lib/constants") return { SITE: { name: "최 선 의 사 랑", url: "https://www.yooreru.com" } };
    if (name === "@/lib/time-zone") return { formatDatePathParts: () => ({ year: "2026", month: "10", day: "17" }) };
    if (name === "@/lib/mail") return { sendMail: async (mail) => {
      mails.push(mail);
      return failedMail ? { error: { message: "Provider unavailable" } } : { id: "test" };
    } };
    throw new Error(`Unexpected import: ${name}`);
  }, exports, { error: (...args) => errors.push(args) });
  const create = () => exports.createPostComment({
    postId: 1, parentId, authorName: "그네", authorEmail: email, actorId,
    content: "읽어 주셔서 감사합니다.\n다음 글에서도 만나요!",
  });
  if (parentId !== null && !parent) {
    await assert.rejects(create, /답글을 남길 댓글/);
    assert.equal(writes, 0);
  } else {
    await create();
    assert.equal(writes, 1);
  }
  return { mails, errors };
}

assert.deepEqual((await run()).mails.map((mail) => mail.to), ["author@example.com"]);
assert.equal((await run({ email: "AUTHOR@example.com" })).mails.length, 0);
assert.equal((await run({ actorId: 2 })).mails.length, 0);
const parent = { authorEmail: "reader@example.com", content: "이 구절이 오래 남네요. 좋은 글 감사합니다." };
const reply = await run({ parent, parentId: 7 });
assert.deepEqual(reply.mails.map((mail) => mail.to), ["author@example.com", "reader@example.com"]);
assert.match(reply.mails[1].subject, /답글 알림/);
assert.match(reply.mails[1].html, /내 댓글.*좋은 글 감사합니다.*새 답글.*읽어 주셔서 감사합니다/);
assert.match(reply.mails[1].html, /<br \/>/);
assert.match(reply.mails[1].html, /#comments/);
assert.deepEqual((await run({ parent, parentId: 7, email: "READER@example.com" })).mails.map((mail) => mail.to), ["author@example.com"]);
assert.deepEqual((await run({ parent: { ...parent, authorEmail: "AUTHOR@example.com" }, parentId: 7 })).mails.map((mail) => mail.to), ["author@example.com"]);
assert.equal((await run({ parent: { ...parent, authorEmail: "author@example.com" }, parentId: 7, actorId: 2 })).mails.length, 0);
assert.deepEqual((await run({ parent: { ...parent, authorEmail: null }, parentId: 7 })).mails.map((mail) => mail.to), ["author@example.com"]);
assert.equal((await run({ parentId: 999 })).mails.length, 0);
const failed = await run({ parent, parentId: 7, failedMail: true });
assert.equal(failed.mails.length, 2);
assert.equal(failed.errors.length, 2);
const escaped = await run({ parent: { ...parent, content: '<script>alert("test")</script>' }, parentId: 7 });
assert.doesNotMatch(escaped.mails[1].html, /<script>/);
assert.match(escaped.mails[1].html, /&lt;script&gt;/);

mkdirSync("/tmp/yooreru-preview", { recursive: true });
writeFileSync("/tmp/yooreru-preview/reply-email.html", `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>답글 알림 이메일 미리보기</title><body style="max-width:640px;margin:40px auto;padding:0 20px;font:16px/1.7 Arial,sans-serif"><p style="color:#666">제목: ${reply.mails[1].subject}</p><hr>${reply.mails[1].html}</body></html>`);
console.log("Comment notifications passed (author, reply, deduplication, self replies, missing email, parent validation, escaping, delivery failure).");
