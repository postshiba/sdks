import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixture, jsonResponse, mockFetch, runCli } from "../support.js";

const KEY = "sk_never_print_this_key";
const env = { POSTSHIBA_API_KEY: KEY, POSTSHIBA_TEAM_ID: "KjkAJW" };

describe("errors", () => {
  it("prints a 422 as Error: message (field: field) and exits 1", async () => {
    const fetchImpl = mockFetch(() => jsonResponse(fixture("error_422"), 422));
    const result = await runCli(["clusters", "create", "--data", JSON.stringify(fixture("cluster_create_request"))], {
      env,
      fetch: fetchImpl,
    });
    assert.equal(result.code, 1);
    assert.equal(result.stderr, "Error: From domain is not verified (field: from)\n");
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });

  it("prints the hourly-limit line for a 429 throttled response", async () => {
    const fetchImpl = mockFetch(() =>
      jsonResponse({ error: "throttled", message: "Hourly send limit reached" }, 429),
    );
    const result = await runCli(
      ["send", "--from", "hello@mail.example.com", "--to", "you@example.com", "--subject", "Hi", "--text", "hello"],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 1);
    assert.equal(
      result.stderr,
      "Error: Hourly send limit reached\nThe cluster hit its hourly send limit. Wait until the next hour before retrying.\n",
    );
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });
});
