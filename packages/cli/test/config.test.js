import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { chmod, readFile, stat, writeFile } from "node:fs/promises";
import { fixture, jsonResponse, lastCall, mockFetch, runCli } from "../support.js";

const KEY = "sk_never_print_this_key";

describe("credentials", () => {
  it("prefers flag over env over config file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    await writeFile(
      join(dir, "config.json"),
      JSON.stringify({ api_key: "sk_from_file", team_id: "fileTeam", base_url: "https://from-file.test" }),
    );
    const fetchImpl = mockFetch(() => jsonResponse([fixture("cluster")]));

    const fromFile = await runCli(["clusters", "list"], { configDir: dir, env: {}, fetch: fetchImpl });
    assert.equal(fromFile.code, 0);
    assert.equal(lastCall(fetchImpl).url, "https://from-file.test/api/v1/teams/fileTeam/clusters");
    assert.equal(lastCall(fetchImpl).headers.get("Authorization"), "Bearer sk_from_file");

    const fromEnv = await runCli(["clusters", "list"], {
      configDir: dir,
      env: {
        POSTSHIBA_API_KEY: "sk_from_env",
        POSTSHIBA_TEAM_ID: "envTeam",
        POSTSHIBA_BASE_URL: "https://from-env.test",
      },
      fetch: fetchImpl,
    });
    assert.equal(fromEnv.code, 0);
    assert.equal(lastCall(fetchImpl).url, "https://from-env.test/api/v1/teams/envTeam/clusters");
    assert.equal(lastCall(fetchImpl).headers.get("Authorization"), "Bearer sk_from_env");

    const fromFlag = await runCli(
      [
        "clusters",
        "list",
        "--api-key",
        "sk_from_flag",
        "--team",
        "flagTeam",
        "--base-url",
        "https://from-flag.test",
      ],
      {
        configDir: dir,
        env: {
          POSTSHIBA_API_KEY: "sk_from_env",
          POSTSHIBA_TEAM_ID: "envTeam",
          POSTSHIBA_BASE_URL: "https://from-env.test",
        },
        fetch: fetchImpl,
      },
    );
    assert.equal(fromFlag.code, 0);
    assert.equal(lastCall(fetchImpl).url, "https://from-flag.test/api/v1/teams/flagTeam/clusters");
    assert.equal(lastCall(fetchImpl).method, "GET");
    assert.equal(lastCall(fetchImpl).headers.get("Authorization"), "Bearer sk_from_flag");
    assert.doesNotMatch(`${fromFlag.stdout}${fromFlag.stderr}`, /sk_from_flag|sk_from_env|sk_from_file/);
  });

  it("exits 2 naming --team when a team-scoped command has no team", async () => {
    const fetchImpl = mockFetch(() => jsonResponse([fixture("cluster")]));
    const result = await runCli(["clusters", "list"], {
      env: { POSTSHIBA_API_KEY: KEY },
      fetch: fetchImpl,
    });
    assert.equal(result.code, 2);
    assert.match(result.stderr, /--team/);
    assert.equal(fetchImpl.calls.length, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });

  it("writes config mode 0600 only after users.me succeeds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    const failFetch = mockFetch(() => jsonResponse(fixture("error_422"), 422));
    const failed = await runCli(["login", "--api-key", KEY, "--team", "KjkAJW"], {
      configDir: dir,
      env: {},
      fetch: failFetch,
    });
    assert.equal(failed.code, 1);
    await assert.rejects(() => readFile(join(dir, "config.json"), "utf8"), { code: "ENOENT" });

    const okFetch = mockFetch(() => jsonResponse(fixture("whoami")));
    const ok = await runCli(["login", "--api-key", KEY, "--team", "KjkAJW"], {
      configDir: dir,
      env: {},
      fetch: okFetch,
    });
    assert.equal(ok.code, 0);
    assert.equal(ok.stdout, "Signed in as noreply+abc@postshiba.com\n");
    const call = lastCall(okFetch);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/users/me");
    assert.equal(call.method, "GET");
    assert.equal(call.headers.get("Authorization"), `Bearer ${KEY}`);
    const saved = JSON.parse(await readFile(join(dir, "config.json"), "utf8"));
    assert.deepEqual(saved, { api_key: KEY, team_id: "KjkAJW" });
    const mode = (await stat(join(dir, "config.json"))).mode & 0o777;
    assert.equal(mode, 0o600);
    assert.doesNotMatch(`${ok.stdout}${ok.stderr}`, /sk_never_print_this_key/);
  });

  it("logout removes the config file and is quiet when it is already gone", async () => {
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    await writeFile(join(dir, "config.json"), JSON.stringify({ api_key: KEY }), { mode: 0o600 });
    await chmod(join(dir, "config.json"), 0o600);
    const gone = await runCli(["logout"], { configDir: dir, env: {} });
    assert.equal(gone.code, 0);
    await assert.rejects(() => readFile(join(dir, "config.json"), "utf8"), { code: "ENOENT" });
    const again = await runCli(["logout"], { configDir: dir, env: {} });
    assert.equal(again.code, 0);
  });
});
