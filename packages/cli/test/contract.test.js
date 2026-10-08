import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { commands, kebab } from "../src/commands.js";

const SKIP = new Set(["users.me", "emails.send", "emails.sendOnCluster"]);
const contractPath = join(dirname(fileURLToPath(import.meta.url)), "..", "../../CONTRACT.md");

function parseContractOperations(text) {
  const ops = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^\| `([A-Za-z]+)\.([A-Za-z]+)` \| \| (GET|POST|PATCH|DELETE) \| `([^`]+)` \|/);
    if (match) ops.push({ resource: match[1], action: match[2], method: match[3], path: match[4] });
  }
  return ops;
}

describe("contract registry", () => {
  it("has one row per CONTRACT.md operation except users.me / emails.send / emails.sendOnCluster", () => {
    const ops = parseContractOperations(readFileSync(contractPath, "utf8")).filter(
      (op) => !SKIP.has(`${op.resource}.${op.action}`),
    );
    assert.ok(ops.length > 0);
    const seen = new Set();
    for (const op of ops) {
      const resource = kebab(op.resource);
      const action = kebab(op.action);
      const row = commands.find((item) => item.resource === resource && item.action === action);
      assert.ok(row, `missing registry row ${resource} ${action}`);
      assert.equal(row.method, op.method, `${resource} ${action} method`);
      assert.equal(row.path, op.path, `${resource} ${action} path`);
      seen.add(`${resource}.${action}`);
    }
    for (const row of commands) {
      assert.ok(seen.has(`${row.resource}.${row.action}`), `extra registry row ${row.resource} ${row.action}`);
    }
    assert.equal(commands.length, ops.length);
  });
});
