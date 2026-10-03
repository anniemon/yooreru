import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const command = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url))).buildCommand;
const dir = mkdtempSync(join(tmpdir(), "vercel-build-"));

try {
  writeFileSync(
    join(dir, "npm"),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALLS"\n[ "$FAIL_MIGRATE" = 1 ] && [ "$2" = db:migrate ] && exit 1\nexit 0\n',
    { mode: 0o755 },
  );

  function run(vercelEnv, failMigrate = false, directUrl = "postgresql://example.invalid/db") {
    const calls = join(dir, "calls");
    writeFileSync(calls, "");
    const result = spawnSync("sh", ["-c", command], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        CALLS: calls,
        VERCEL_ENV: vercelEnv,
        DIRECT_URL: directUrl,
        FAIL_MIGRATE: failMigrate ? "1" : "0",
      },
    });
    return { status: result.status, calls: readFileSync(calls, "utf8").trim().split("\n").filter(Boolean) };
  }

  assert.deepEqual(run("production"), { status: 0, calls: ["run db:migrate", "run build"] });
  assert.deepEqual(run("preview"), { status: 0, calls: ["run build"] });
  assert.deepEqual(run("production", true), { status: 1, calls: ["run db:migrate"] });
  assert.deepEqual(run("production", false, ""), { status: 1, calls: [] });
  assert.deepEqual(run(""), { status: 1, calls: [] });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
