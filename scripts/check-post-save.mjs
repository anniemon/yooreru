// Run: node scripts/check-post-save.mjs
// Exercise the actual form handlers with delayed Server Actions; no database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("src/components/admin-post-form.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function mount() {
  let tick;
  let finish;
  let calls = 0;
  const effects = [];
  const exports = {};
  const fields = new Map([["title", "Test"], ["status", "DRAFT"], ["contentHtml", "<p>Test</p>"]]);
  const action = () => {
    calls++;
    return new Promise((resolve, reject) => { finish = { resolve, reject }; });
  };
  const jsx = (type, props) => ({ type, props });
  const hooks = {
    useRef: (current) => ({ current }),
    useState: (value) => [value, () => {}],
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
  };
  runInNewContext(source, {
    exports,
    require: (name) => {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name === "@/app/admin/actions") return { savePost: action, autosavePost: action };
      if (name === "@/lib/time-zone") return { formatDateTimeLocal: () => "" };
      if (name === "lucide-react") return {};
      throw new Error(`Unexpected import: ${name}`);
    },
    FormData: class extends Map { constructor() { super(fields); } },
    window: { setInterval: (fn) => { tick = fn; }, clearInterval() {}, location: { pathname: "/test" } },
  });
  const form = exports.AdminPostForm({ categories: [], timeZone: "Asia/Seoul" });
  form.props.ref.current = {};
  effects.forEach((effect) => effect());
  return {
    tick: () => tick(),
    submit: () => {
      let prevented = false;
      form.props.onSubmit?.({ preventDefault: () => { prevented = true; } });
      return !prevented;
    },
    save: () => form.props.action(new Map(fields)),
    finish: (failed = false) => failed
      ? finish.reject(new Error("Save failed"))
      : finish.resolve({ skipped: false, id: 42, savedAt: new Date().toISOString() }),
    calls: () => calls,
  };
}

// The submit lock must work before a state update/rerender or queued action runs.
const manual = mount();
assert.equal(manual.submit(), true);
assert.equal(manual.submit(), false, "rapid second submit must be blocked");
manual.tick();
assert.equal(manual.calls(), 0, "autosave must not start after manual submit");
const pending = manual.save();
manual.tick();
assert.equal(manual.calls(), 1);
manual.finish();
await pending;

// First autosave has no post ID yet: manual submission must wait for it.
const automatic = mount();
automatic.tick();
assert.equal(automatic.calls(), 1);
assert.equal(automatic.submit(), false, "manual submit during autosave must be blocked");
automatic.tick();
assert.equal(automatic.calls(), 1, "overlapping autosaves must be blocked");
automatic.finish();
await new Promise(setImmediate);
assert.equal(automatic.submit(), true);

// A rejected request must release the lock so the user can retry.
const failed = mount();
assert.equal(failed.submit(), true);
const rejected = failed.save();
failed.finish(true);
await assert.rejects(rejected, /Save failed/);
assert.equal(failed.submit(), true);
const failedAuto = mount();
failedAuto.tick();
failedAuto.finish(true);
await new Promise(setImmediate);
assert.equal(failedAuto.submit(), true);
console.log("Post save checks passed (double submit, autosave overlap, failure retry).");
