import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixture, fakePrompts, jsonResponse, mockFetch, runCli } from "../support.js";

const KEY = "sk_never_print_this_key";
const env = { POSTSHIBA_API_KEY: KEY, POSTSHIBA_TEAM_ID: "KjkAJW" };

describe("plain mode", () => {
  it("never prompts", async () => {
    const prompts = fakePrompts();
    const fetchImpl = mockFetch(() => jsonResponse([fixture("cluster")]));
    const result = await runCli(["clusters", "list"], { env, fetch: fetchImpl, prompts, isTTY: false });
    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), [fixture("cluster")]);
    assert.deepEqual(prompts.calls, []);
  });

  it("exits 2 when a destructive action has no --yes", async () => {
    const prompts = fakePrompts();
    const fetchImpl = mockFetch(() => jsonResponse(fixture("cluster_deprovisioned")));
    const result = await runCli(["clusters", "delete", "NmQpXr"], { env, fetch: fetchImpl, prompts });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /--yes/);
    assert.match(result.stderr, /postshiba help clusters/);
    assert.equal(fetchImpl.calls.length, 0);
    assert.deepEqual(prompts.calls, []);
  });

  it("deletes when --yes is set", async () => {
    const fetchImpl = mockFetch(() => jsonResponse(fixture("cluster_deprovisioned")));
    const result = await runCli(["clusters", "delete", "NmQpXr", "--yes"], { env, fetch: fetchImpl });
    assert.equal(result.code, 0);
    assert.equal(fetchImpl.calls[0].url, "https://app.postshiba.com/api/v1/clusters/NmQpXr");
    assert.equal(fetchImpl.calls[0].method, "DELETE");
    assert.deepEqual(JSON.parse(result.stdout), fixture("cluster_deprovisioned"));
  });
});
