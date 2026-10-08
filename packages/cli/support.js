import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { main } from "./src/cli.js";

export const catalog = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/catalog");

export function fixture(name) {
  return JSON.parse(readFileSync(join(catalog, `${name}.json`), "utf8"));
}

export function collect() {
  const chunks = [];
  return {
    write(chunk) {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    },
    text() {
      return chunks.join("");
    },
  };
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function mockFetch(impl) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url,
      method: init.method,
      headers: new Headers(init.headers),
      body: init.body,
    });
    return impl(url, init, calls);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

export async function runCli(argv, overrides = {}) {
  const stdout = collect();
  const stderr = collect();
  const fetchImpl = overrides.fetch ?? mockFetch(() => jsonResponse({}));
  const configDir = overrides.configDir;
  const env = {
    HOME: overrides.home ?? "/tmp/postshiba-missing-home",
    XDG_CONFIG_HOME: overrides.xdg ?? "/tmp/postshiba-missing-xdg",
    ...overrides.env,
  };
  const code = await main(argv, {
    env,
    stdout,
    stderr,
    stdin: overrides.stdin ?? Readable.from([]),
    configDir,
    fetch: fetchImpl,
  });
  return { code, stdout: stdout.text(), stderr: stderr.text(), fetch: fetchImpl };
}

export function lastCall(fetchImpl) {
  return fetchImpl.calls.at(-1);
}
