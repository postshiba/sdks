import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PostShibaError, request } from "./client.js";
import { UsageError } from "./errors.js";
import { actionUsage, commands, findCommand, interpolatePath, pathParamNames, resources } from "./commands.js";
import { readConfig, removeConfig, resolveCredentials, writeConfig } from "./config.js";
import { buildSendBody, loadData, readStream, sendRoute } from "./send.js";

const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"))
  .version;

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  version: { type: "boolean" },
  "api-key": { type: "string" },
  team: { type: "string" },
  "base-url": { type: "string" },
  data: { type: "string" },
  output: { type: "string" },
  from: { type: "string" },
  to: { type: "string", multiple: true },
  cc: { type: "string", multiple: true },
  bcc: { type: "string", multiple: true },
  "reply-to": { type: "string" },
  subject: { type: "string" },
  text: { type: "string" },
  "text-file": { type: "string" },
  html: { type: "string" },
  "html-file": { type: "string" },
  template: { type: "string" },
  var: { type: "string", multiple: true },
  header: { type: "string", multiple: true },
  arg: { type: "string", multiple: true },
  attach: { type: "string", multiple: true },
  tenant: { type: "string" },
  cluster: { type: "string" },
  sandbox: { type: "boolean" },
  "idempotency-key": { type: "string" },
};

export { commands };

export async function main(argv, io = {}) {
  const ctx = {
    env: io.env ?? process.env,
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
    stdin: io.stdin ?? process.stdin,
    configDir: io.configDir,
    fetch: io.fetch ?? globalThis.fetch,
  };

  try {
    return await run(argv, ctx);
  } catch (err) {
    if (err instanceof UsageError) {
      ctx.stderr.write(`${err.message}\n`);
      ctx.stderr.write(`See postshiba help${err.helpResource ? ` ${err.helpResource}` : ""}.\n`);
      return 2;
    }
    if (err instanceof PostShibaError) {
      writeApiError(ctx.stderr, err);
      return 1;
    }
    ctx.stderr.write(`${err && err.message ? err.message : err}\n`);
    return 1;
  }
}

async function run(argv, ctx) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (err) {
    throw new UsageError(err.message);
  }

  const { values, positionals } = parsed;
  if (values.help || positionals[0] === "help") {
    const topic = values.help ? positionals[0] : positionals[1];
    ctx.stdout.write(`${formatHelp(topic)}\n`);
    return 0;
  }
  if (values.version) {
    ctx.stdout.write(`postshiba ${VERSION}\n`);
    return 0;
  }
  if (positionals.length === 0) {
    throw new UsageError("Missing command");
  }

  const [command, ...rest] = positionals;
  if (command === "login") return login(values, ctx);
  if (command === "logout") return logout(ctx);
  if (command === "whoami") return whoami(values, ctx);
  if (command === "send") return send(values, ctx);
  return resourceCommand(command, rest, values, ctx);
}

async function login(values, ctx) {
  let apiKey = values["api-key"] || ctx.env.POSTSHIBA_API_KEY;
  if (!apiKey && ctx.stdin.isTTY) {
    ctx.stderr.write("API key: ");
    apiKey = (await readStream(ctx.stdin)).trim();
  }
  if (!apiKey) {
    throw new UsageError("Missing API key. Run postshiba login or set POSTSHIBA_API_KEY.");
  }
  const teamId = values.team || ctx.env.POSTSHIBA_TEAM_ID;
  const baseUrl = (values["base-url"] || ctx.env.POSTSHIBA_BASE_URL || "https://app.postshiba.com").replace(/\/$/, "");
  const me = await request({
    method: "GET",
    url: `${baseUrl}/api/v1/users/me`,
    apiKey,
    fetch: ctx.fetch,
  });
  const saved = { api_key: apiKey };
  if (teamId) saved.team_id = teamId;
  if (values["base-url"] || ctx.env.POSTSHIBA_BASE_URL) saved.base_url = baseUrl;
  await writeConfig(ctx.env, ctx.configDir, saved);
  ctx.stdout.write(`Signed in as ${me.email}\n`);
  return 0;
}

async function logout(ctx) {
  await removeConfig(ctx.env, ctx.configDir);
  return 0;
}

async function whoami(values, ctx) {
  const creds = await credentials(values, ctx, { team: false });
  const body = await request({
    method: "GET",
    url: `${creds.baseUrl}/api/v1/users/me`,
    apiKey: creds.apiKey,
    fetch: ctx.fetch,
  });
  writeJson(ctx.stdout, body);
  return 0;
}

async function send(values, ctx) {
  const route = sendRoute(values);
  const creds = await credentials(values, ctx, { team: route.team });
  const body = await buildSendBody(values, ctx.stdin);
  if (route.sandbox) body.sandbox = true;
  const headers = {};
  if (route.team) {
    if (route.idempotencyKey) headers["Idempotency-Key"] = route.idempotencyKey;
  } else if (route.clusterId) {
    headers["X-Capsule-Cluster-Id"] = String(route.clusterId);
  }
  const path = interpolatePath(route.path, { teamId: creds.teamId, clusterId: route.clusterId });
  const result = await request({
    method: "POST",
    url: `${creds.baseUrl}${path}`,
    apiKey: creds.apiKey,
    body,
    headers,
    fetch: ctx.fetch,
  });
  writeJson(ctx.stdout, result);
  return 0;
}

async function resourceCommand(resource, rest, values, ctx) {
  const known = resources();
  if (!known.includes(resource)) {
    throw new UsageError(`Unknown command ${resource}`, { helpResource: undefined });
  }
  const action = rest[0];
  if (!action) {
    throw new UsageError(`Missing action for ${resource}`, { helpResource: resource });
  }
  const row = findCommand(resource, action);
  if (!row) {
    throw new UsageError(`Unknown action ${action} for ${resource}`, { helpResource: resource });
  }
  const names = pathParamNames(row.path);
  const ids = rest.slice(1);
  if (ids.length < names.length) {
    throw new UsageError(`Missing ${names[ids.length]}`, { helpResource: resource });
  }
  if (ids.length > names.length) {
    throw new UsageError(`Unexpected extra argument ${ids[names.length]}`, { helpResource: resource });
  }
  if (row.data && values.data === undefined) {
    throw new UsageError(`Missing --data`, { helpResource: resource });
  }

  const creds = await credentials(values, ctx, { team: row.path.includes(":teamId") });
  const params = { teamId: creds.teamId };
  names.forEach((name, i) => {
    params[name] = ids[i];
  });
  const path = interpolatePath(row.path, params);
  const body = row.data ? await loadData(values.data, ctx.stdin) : undefined;
  const result = await request({
    method: row.method,
    url: `${creds.baseUrl}${path}`,
    apiKey: creds.apiKey,
    body,
    binary: row.binary,
    fetch: ctx.fetch,
  });

  if (row.binary) {
    if (values.output) await writeFile(values.output, result);
    else ctx.stdout.write(result);
    return 0;
  }
  writeJson(ctx.stdout, result);
  return 0;
}

async function credentials(values, ctx, { team }) {
  const file = await readConfig(ctx.env, ctx.configDir);
  const creds = resolveCredentials(values, ctx.env, file);
  if (!creds.apiKey) {
    throw new UsageError("Missing API key. Run postshiba login or set POSTSHIBA_API_KEY.");
  }
  if (team && !creds.teamId) {
    throw new UsageError("Missing team id. Pass --team, set POSTSHIBA_TEAM_ID, or save one with postshiba login.");
  }
  return creds;
}

function writeJson(stdout, value) {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeApiError(stderr, err) {
  let line = `Error: ${err.message}`;
  if (err.field) line += ` (field: ${err.field})`;
  stderr.write(`${line}\n`);
  if (err.status === 429 && err.error === "throttled") {
    stderr.write("The cluster hit its hourly send limit. Wait until the next hour before retrying.\n");
  }
}

export function formatHelp(topic) {
  if (!topic) return generalHelp();
  if (topic === "send") return sendHelp();
  if (topic === "login" || topic === "logout" || topic === "whoami") return generalHelp();
  const rows = commands.filter((row) => row.resource === topic);
  if (rows.length === 0) {
    throw new UsageError(`Unknown resource ${topic}`);
  }
  const lines = [`Usage: postshiba ${topic} <action> [ids]`, "", "Actions:"];
  for (const row of rows) {
    lines.push(`  ${actionUsage(row)}`);
  }
  lines.push("", "Pass --data JSON, --data @file.json, or --data - for writes.");
  return lines.join("\n");
}

function generalHelp() {
  const width = Math.max(...resources().map((name) => name.length));
  const lines = [
    "Usage: postshiba <command>",
    "",
    "Commands:",
    "  login                 Sign in and write the local config file",
    "  logout                Remove the local config file",
    "  whoami                Print the signed-in user",
    "  send                  Send an email",
    "  help [resource]       Show this help or help for a resource",
    "",
    "Resources:",
  ];
  for (const name of resources()) {
    const actions = commands.filter((row) => row.resource === name).map((row) => row.action);
    lines.push(`  ${name.padEnd(width)}  ${actions.join(", ")}`);
  }
  lines.push(
    "",
    "Options:",
    "  --api-key KEY         API key (POSTSHIBA_API_KEY)",
    "  --team ID             Team id (POSTSHIBA_TEAM_ID)",
    "  --base-url URL        API base URL (POSTSHIBA_BASE_URL)",
    "  -h, --help            Show help",
    "  --version             Print version",
  );
  return lines.join("\n");
}

function sendHelp() {
  return [
    "Usage: postshiba send [options]",
    "",
    "  --from ADDR           from",
    "  --to ADDR             to (repeatable)",
    "  --cc ADDR --bcc ADDR  cc / bcc (repeatable)",
    "  --reply-to ADDR       reply_to",
    "  --subject TEXT        subject",
    "  --text TEXT           text",
    "  --html HTML           html",
    "  --template ID         template.id",
    "  --var KEY=VALUE       template.variables (repeatable)",
    "  --header \"Name: value\" headers (repeatable)",
    "  --arg KEY=VALUE       unique_args (repeatable)",
    "  --attach PATH         attachments (repeatable)",
    "  --tenant NAME         tenant",
    "  --cluster ID          X-Capsule-Cluster-Id on POST /api/v1/emails",
    "  --sandbox             POST /api/v1/teams/:teamId/clusters/:clusterId/sends (requires --cluster)",
    "  --idempotency-key KEY Idempotency-Key on the cluster send path (requires --cluster)",
    "  --data JSON           base body; flags override keys",
  ].join("\n");
}
