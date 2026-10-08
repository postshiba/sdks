import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { fixture, jsonResponse, lastCall, mockFetch, runCli } from "../support.js";

const KEY = "sk_never_print_this_key";
const env = { POSTSHIBA_API_KEY: KEY, POSTSHIBA_TEAM_ID: "KjkAJW" };

describe("data and attachments", () => {
  it("exits 2 when create is missing --data", async () => {
    const fetchImpl = mockFetch(() => jsonResponse(fixture("cluster")));
    const result = await runCli(["clusters", "create"], { env, fetch: fetchImpl });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /--data/);
    assert.match(result.stderr, /postshiba help clusters/);
    assert.equal(fetchImpl.calls.length, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });

  it("accepts --data @file and --data -", async () => {
    const body = fixture("cluster_create_request");
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    const file = join(dir, "cluster.json");
    await writeFile(file, JSON.stringify(body));

    const fromFile = mockFetch(() => jsonResponse(fixture("cluster")));
    const fileResult = await runCli(["clusters", "create", "--data", `@${file}`], { env, fetch: fromFile });
    assert.equal(fileResult.code, 0);
    const fileCall = lastCall(fromFile);
    assert.equal(fileCall.url, "https://app.postshiba.com/api/v1/teams/KjkAJW/clusters");
    assert.equal(fileCall.method, "POST");
    assert.equal(fileCall.headers.get("Authorization"), `Bearer ${KEY}`);
    assert.equal(fileCall.headers.get("Content-Type"), "application/json");
    assert.deepEqual(JSON.parse(fileCall.body), body);

    const fromStdin = mockFetch(() => jsonResponse(fixture("cluster")));
    const stdinResult = await runCli(["clusters", "create", "--data", "-"], {
      env,
      fetch: fromStdin,
      stdin: Readable.from([JSON.stringify(body)]),
    });
    assert.equal(stdinResult.code, 0);
    const stdinCall = lastCall(fromStdin);
    assert.equal(stdinCall.url, "https://app.postshiba.com/api/v1/teams/KjkAJW/clusters");
    assert.equal(stdinCall.method, "POST");
    assert.deepEqual(JSON.parse(stdinCall.body), body);
    assert.doesNotMatch(`${fileResult.stdout}${fileResult.stderr}${stdinResult.stdout}${stdinResult.stderr}`, /sk_never_print_this_key/);
  });

  it("writes download-attachment bytes to --output", async () => {
    const bytes = Buffer.from("png-bytes");
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    const output = join(dir, "photo.png");
    const fetchImpl = mockFetch(() => new Response(bytes, { status: 200 }));
    const result = await runCli(
      ["messages", "download-attachment", "PqRzMn", "GxTyVu", "1", "--output", output],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 0);
    const call = lastCall(fetchImpl);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1");
    assert.equal(call.method, "GET");
    assert.equal(call.headers.get("Authorization"), `Bearer ${KEY}`);
    assert.equal(await readFile(output, "utf8"), "png-bytes");
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });
});
