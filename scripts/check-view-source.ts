import assert from "node:assert/strict";
import { classifyViewSource } from "../src/lib/view-source";

const host = "www.yooreru.com";
assert.equal(classifyViewSource("https://www.google.co.kr/search?q=yooreru", null, host), "GOOGLE");
assert.equal(classifyViewSource("https://l.instagram.com/", null, host), "INSTAGRAM");
assert.equal(classifyViewSource("https://search.naver.com/", null, host), "NAVER");
assert.equal(classifyViewSource("https://x.com/", null, host), "X");
assert.equal(classifyViewSource("https://mobile.twitter.com/", null, host), "X");
assert.equal(classifyViewSource("https://t.co/example", null, host), "X");
assert.equal(classifyViewSource("", "twitter", host), "X");
assert.equal(classifyViewSource("", "x", host), "X");
assert.equal(classifyViewSource("https://x.com.evil.com/", null, host), "OTHER");
assert.equal(classifyViewSource("https://google.evil.com/", null, host), "OTHER");
assert.equal(classifyViewSource("https://www.yooreru.com/", null, host), null);
assert.equal(classifyViewSource("", null, host), null);
assert.equal(classifyViewSource("", "ig", host), "INSTAGRAM");
