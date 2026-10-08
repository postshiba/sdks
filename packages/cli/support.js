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

export function fakePrompts(answers = {}) {
  const calls = [];
  const outros = [];
  const take = (name, fallback) => {
    calls.push(name);
    const queue = answers[name];
    if (Array.isArray(queue)) {
      if (queue.length === 0) throw new Error(`prompted ${name} with no answer`);
      return queue.shift();
    }
    if (queue !== undefined) return queue;
    return fallback;
  };
  return {
    calls,
    text: async () => take("text", ""),
    password: async () => take("password", ""),
    select: async () => take("select", ""),
    confirm: async () => take("confirm", true),
    intro() {
      calls.push("intro");
    },
    outros,
    outro(message) {
      calls.push("outro");
      outros.push(message);
    },
    note() {
      calls.push("note");
    },
    spinner() {
      calls.push("spinner");
      return {
        start() {},
        stop() {},
        error() {
          calls.push("spinner-error");
        },
      };
    },
    cancel() {
      calls.push("cancel");
    },
    log: {
      success() {},
      error() {},
      info() {},
    },
  };
}

export async function runCli(argv, overrides = {}) {
  const stdout = collect();
  const stderr = collect();
  const fetchImpl = overrides.fetch ?? mockFetch(() => jsonResponse({}));
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
    configDir: overrides.configDir,
    fetch: fetchImpl,
    isTTY: overrides.isTTY,
    cwd: overrides.cwd,
    home: overrides.home,
    prompts: overrides.prompts,
    sleep: overrides.sleep ?? (async () => {}),
  });
  return { code, stdout: stdout.text(), stderr: stderr.text(), fetch: fetchImpl };
}

export function lastCall(fetchImpl) {
  return fetchImpl.calls.at(-1);
}
