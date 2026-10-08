import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fakePrompts, fixture, jsonResponse, lastCall, mockFetch, runCli } from "../support.js";

const KEY = "sk_never_print_this_key";

describe("interactive", () => {
  it("drives login prompts and saves cluster_id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    const prompts = fakePrompts({
      password: ["typed-key"],
      text: ["KjkAJW"],
      select: ["NmQpXr"],
    });
    const fetchImpl = mockFetch((url) => {
      if (String(url).endsWith("/users/me")) return jsonResponse(fixture("whoami"));
      if (String(url).endsWith("/clusters")) return jsonResponse([fixture("cluster"), { id: "AbCdEf", name: "other" }]);
      return jsonResponse({});
    });
    const result = await runCli(["login"], {
      configDir: dir,
      env: {},
      fetch: fetchImpl,
      prompts,
      isTTY: true,
    });
    assert.equal(result.code, 0);
    assert.equal(result.stdout, "Signed in as noreply+abc@postshiba.com\n");
    assert.equal(lastCall(fetchImpl).url, "https://app.postshiba.com/api/v1/teams/KjkAJW/clusters");
    const saved = JSON.parse(await readFile(join(dir, "config.json"), "utf8"));
    assert.deepEqual(saved, { api_key: "typed-key", team_id: "KjkAJW", cluster_id: "NmQpXr" });
    assert.equal((await stat(join(dir, "config.json"))).mode & 0o777, 0o600);
    assert.ok(prompts.calls.includes("password"));
    assert.ok(prompts.calls.includes("text"));
    assert.ok(prompts.calls.includes("select"));
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /typed-key/);
  });

  it("confirms send after a preview and prints the message id", async () => {
    const prompts = fakePrompts({ confirm: [true] });
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_send_response")));
    const result = await runCli(
      ["send", "--from", "hello@mail.example.com", "--to", "you@example.com", "--subject", "Hi", "--text", "hello"],
      {
        env: { POSTSHIBA_API_KEY: KEY, POSTSHIBA_TEAM_ID: "KjkAJW" },
        fetch: fetchImpl,
        prompts,
        isTTY: true,
      },
    );
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Sent abc@capsule.test/);
    assert.ok(prompts.calls.includes("note"));
    assert.ok(prompts.calls.includes("confirm"));
    assert.equal(lastCall(fetchImpl).url, "https://app.postshiba.com/api/v1/emails");
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });

  it("renders the main menu and quits", async () => {
    const prompts = fakePrompts({ select: ["quit"] });
    const result = await runCli([], { env: {}, prompts, isTTY: true });
    assert.equal(result.code, 0);
    assert.ok(prompts.calls.includes("intro"));
    assert.ok(prompts.calls.includes("outro"));
    assert.ok(prompts.calls.includes("select"));
  });
});
