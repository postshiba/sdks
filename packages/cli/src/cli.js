// @ts-check

import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { PostShibaError, request } from "./client.js";
import { actionsFor, commands, findCommand, interpolatePath, resources } from "./commands.js";
import { readConfig, resolveCredentials } from "./config.js";
import { createSendingDomainWizard } from "./domains.js";
import { runDoctor, doctorLabel } from "./doctor.js";
import { CancelError, UsageError, writeApiError } from "./errors.js";
import { formatHelp } from "./help.js";
import { login, logout } from "./login.js";
import { mainMenu } from "./menu.js";
import { isInteractive } from "./mode.js";
import { VERSION } from "./pkg.js";
import { createClackPrompts, spinning } from "./prompts.js";
import { asRecords, colorsFor, formatSummary, formatTable, writeJson } from "./render.js";
import { buildSendBody, completeSendFlags, loadData, sendPreview, sendRoute } from "./send.js";
import { installSkill } from "./skills.js";

const OPTIONS = {
  help: { type: /** @type {const} */ ("boolean"), short: "h" },
  version: { type: /** @type {const} */ ("boolean") },
  json: { type: /** @type {const} */ ("boolean") },
  "no-input": { type: /** @type {const} */ ("boolean") },
  yes: { type: /** @type {const} */ ("boolean") },
  "api-key": { type: /** @type {const} */ ("string") },
  team: { type: /** @type {const} */ ("string") },
  "base-url": { type: /** @type {const} */ ("string") },
  data: { type: /** @type {const} */ ("string") },
  output: { type: /** @type {const} */ ("string") },
  from: { type: /** @type {const} */ ("string") },
  to: { type: /** @type {const} */ ("string"), multiple: true },
  cc: { type: /** @type {const} */ ("string"), multiple: true },
  bcc: { type: /** @type {const} */ ("string"), multiple: true },
  "reply-to": { type: /** @type {const} */ ("string") },
  subject: { type: /** @type {const} */ ("string") },
  text: { type: /** @type {const} */ ("string") },
  "text-file": { type: /** @type {const} */ ("string") },
  html: { type: /** @type {const} */ ("string") },
  "html-file": { type: /** @type {const} */ ("string") },
  template: { type: /** @type {const} */ ("string") },
  var: { type: /** @type {const} */ ("string"), multiple: true },
  header: { type: /** @type {const} */ ("string"), multiple: true },
  arg: { type: /** @type {const} */ ("string"), multiple: true },
  attach: { type: /** @type {const} */ ("string"), multiple: true },
  tenant: { type: /** @type {const} */ ("string") },
  cluster: { type: /** @type {const} */ ("string") },
  sandbox: { type: /** @type {const} */ ("boolean") },
  "idempotency-key": { type: /** @type {const} */ ("string") },
  global: { type: /** @type {const} */ ("boolean") },
  target: { type: /** @type {const} */ ("string") },
};

export { commands, formatHelp };

/**
 * @param {string[]} argv
 * @param {object} [io]
 * @param {NodeJS.ProcessEnv} [io.env]
 * @param {{ write: (chunk: string | Uint8Array) => unknown, isTTY?: boolean }} [io.stdout]
 * @param {{ write: (chunk: string | Uint8Array) => unknown, isTTY?: boolean }} [io.stderr]
 * @param {AsyncIterable<string | Uint8Array> & { isTTY?: boolean }} [io.stdin]
 * @param {string} [io.configDir]
 * @param {boolean} [io.isTTY]
 * @param {string} [io.cwd]
 * @param {string} [io.home]
 * @param {typeof fetch} [io.fetch]
 * @param {import("./prompts.js").Prompts} [io.prompts]
 * @param {(ms: number) => Promise<void>} [io.sleep]
 */
export async function main(argv, io = {}) {
  const ctx = {
    env: io.env ?? process.env,
    stdout: io.stdout ?? process.stdout,
    stderr: io.stderr ?? process.stderr,
    stdin: io.stdin ?? process.stdin,
    configDir: io.configDir,
    isTTY: io.isTTY,
    cwd: io.cwd,
    home: io.home,
    fetch: io.fetch ?? globalThis.fetch,
    prompts: io.prompts,
    sleep: io.sleep,
    interactive: false,
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
    if (err instanceof CancelError) {
      ctx.stderr.write("Cancelled.\n");
      return 130;
    }
    ctx.stderr.write(`${err && /** @type {Error} */ (err).message ? /** @type {Error} */ (err).message : err}\n`);
    return 1;
  }
}

/**
 * @param {string[]} argv
 * @param {any} ctx
 */
async function run(argv, ctx) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (err) {
    throw new UsageError(/** @type {Error} */ (err).message);
  }

  const { values, positionals } = parsed;
  ctx.interactive = isInteractive(values, ctx);
  if (ctx.interactive && !ctx.prompts) ctx.prompts = createClackPrompts();

  if (values.help || positionals[0] === "help") {
    const topic = values.help ? positionals[0] : positionals[1];
    if (topic && topic !== "send" && topic !== "login" && topic !== "logout" && topic !== "whoami" && topic !== "doctor" && topic !== "skills") {
      if (actionsFor(topic).length === 0) throw new UsageError(`Unknown resource ${topic}`);
    }
    ctx.stdout.write(`${formatHelp(topic)}\n`);
    return 0;
  }
  if (values.version) {
    ctx.stdout.write(`postshiba ${VERSION}\n`);
    return 0;
  }
  if (positionals.length === 0) {
    if (ctx.interactive && ctx.prompts) {
      return mainMenu(ctx, (choice, action) => dispatch(choice, action ? [action] : [], values, ctx));
    }
    throw new UsageError("Missing command");
  }

  const [command, ...rest] = positionals;
  return dispatch(command, rest, values, ctx);
}

/**
 * @param {string} command
 * @param {string[]} rest
 * @param {Record<string, any>} values
 * @param {any} ctx
 */
async function dispatch(command, rest, values, ctx) {
  if (command === "login") return login(values, ctx);
  if (command === "logout") return logout(ctx);
  if (command === "whoami") return whoami(values, ctx);
  if (command === "send") return send(values, ctx);
  if (command === "doctor") return doctor(values, ctx);
  if (command === "skills") {
    if (rest[0] !== "install") throw new UsageError("Usage: postshiba skills install", { helpResource: "skills" });
    return installSkill(values, ctx);
  }
  return resourceCommand(command, rest, values, ctx);
}

/**
 * @param {Record<string, any>} values
 * @param {any} ctx
 */
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

/**
 * @param {Record<string, any>} values
 * @param {any} ctx
 */
async function send(values, ctx) {
  const creds = await credentials(values, ctx, { team: false });
  let next = values;
  if (ctx.interactive && ctx.prompts) {
    next = await completeSendFlags(
      values,
      {
        prompts: ctx.prompts,
        api: (method, path) =>
          request({
            method,
            url: `${creds.baseUrl}${path}`,
            apiKey: creds.apiKey,
            fetch: ctx.fetch,
          }),
      },
      creds,
    );
  }
  const route = sendRoute(next, creds.clusterId);
  if (route.team && !creds.teamId) {
    throw new UsageError("Missing team id. Pass --team, set POSTSHIBA_TEAM_ID, or save one with postshiba login.");
  }
  const body = await buildSendBody(next, ctx.stdin);
  if (route.sandbox) body.sandbox = true;
  /** @type {Record<string, string>} */
  const headers = {};
  if (route.team) {
    if (route.idempotencyKey) headers["Idempotency-Key"] = route.idempotencyKey;
  } else if (route.clusterId) {
    headers["X-Capsule-Cluster-Id"] = String(route.clusterId);
  }
  const path = interpolatePath(route.path, { teamId: creds.teamId, clusterId: route.clusterId });

  if (ctx.interactive && ctx.prompts) {
    ctx.prompts.note(sendPreview(body, route), "Send");
    const ok = await ctx.prompts.confirm({ message: "Send this email?" });
    if (!ok) throw new CancelError();
    const result = /** @type {Record<string, unknown>} */ (
      await spinning(
        ctx.prompts,
        "Sending",
        () => request({ method: "POST", url: `${creds.baseUrl}${path}`, apiKey: creds.apiKey, body, headers, fetch: ctx.fetch }),
        () => (body.sandbox ? "Checked in sandbox. Nothing was delivered." : "Queued"),
      )
    );
    ctx.prompts.outro(`Message id ${colorsFor(ctx).cyan(String(result.message_id ?? ""))}`);
    return 0;
  }

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

/**
 * @param {Record<string, any>} values
 * @param {any} ctx
 */
async function doctor(values, ctx) {
  const file = await readConfig(ctx.env, ctx.configDir);
  const creds = resolveCredentials(values, ctx.env, file);
  const report = await runDoctor(creds, ctx.fetch);
  if (!ctx.interactive || values.json) {
    writeJson(ctx.stdout, report);
    return report.ok ? 0 : 1;
  }
  const c = colorsFor(ctx);
  for (const check of report.checks) {
    const mark = check.ok ? c.green("✔") : c.red("✖");
    const extra = check.detail ? ` ${c.dim(check.detail)}` : "";
    ctx.stdout.write(`${mark} ${doctorLabel(check)}${extra}\n`);
    if (!check.ok && check.fix) ctx.stdout.write(`  ${c.dim(check.fix)}\n`);
  }
  return report.ok ? 0 : 1;
}

/**
 * @param {string} resource
 * @param {string[]} rest
 * @param {Record<string, any>} values
 * @param {any} ctx
 */
async function resourceCommand(resource, rest, values, ctx) {
  const known = resources();
  if (!known.includes(resource)) {
    throw new UsageError(`Unknown command ${resource}`);
  }
  let action = rest[0];
  if (!action) {
    if (ctx.interactive && ctx.prompts) {
      action = await ctx.prompts.select({
        message: `${resource} action`,
        options: actionsFor(resource).map((row) => ({ value: row.action, label: row.action })),
      });
    } else {
      throw new UsageError(`Missing action for ${resource}`, { helpResource: resource });
    }
  }
  const row = findCommand(resource, action);
  if (!row) {
    throw new UsageError(`Unknown action ${action} for ${resource}`, { helpResource: resource });
  }

  const names = row.ids;
  /** @type {string[]} */
  let ids = rest.slice(1);
  if (ctx.interactive && ctx.prompts) {
    while (ids.length < names.length) {
      const name = names[ids.length];
      ids.push(await ctx.prompts.text({ message: name ?? "id" }));
    }
  }
  if (ids.length < names.length) {
    throw new UsageError(`Missing ${names[ids.length]}`, { helpResource: resource });
  }
  if (ids.length > names.length) {
    throw new UsageError(`Unexpected extra argument ${ids[names.length]}`, { helpResource: resource });
  }

  const wizard =
    ctx.interactive &&
    resource === "sending-domains" &&
    action === "create" &&
    values.data === undefined;
  if (row.data && values.data === undefined && !wizard) {
    if (ctx.interactive && ctx.prompts) {
      const raw = await ctx.prompts.text({ message: "--data JSON" });
      values = { ...values, data: raw };
    } else {
      throw new UsageError(`Missing --data`, { helpResource: resource });
    }
  }

  if (row.destructive && !values.yes) {
    if (ctx.interactive && ctx.prompts) {
      const ok = await ctx.prompts.confirm({ message: `Run ${resource} ${action}?` });
      if (!ok) throw new CancelError();
    } else {
      throw new UsageError(`Refusing ${action} without --yes.`, { helpResource: resource });
    }
  }

  const creds = await credentials(values, ctx, { team: row.team });

  if (wizard) {
    const created = await createSendingDomainWizard(ctx, {
      apiKey: creds.apiKey,
      teamId: /** @type {string} */ (creds.teamId),
      baseUrl: creds.baseUrl,
    });
    if (values.json) writeJson(ctx.stdout, created);
    return 0;
  }

  /** @type {Record<string, string | undefined>} */
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
    const bytes = /** @type {Buffer} */ (result);
    if (values.output) await writeFile(values.output, bytes);
    else ctx.stdout.write(bytes);
    return 0;
  }

  if (ctx.interactive && !values.json) {
    renderResult(ctx, row, result);
    return 0;
  }
  writeJson(ctx.stdout, result);
  return 0;
}

/**
 * @param {any} ctx
 * @param {import("./commands.js").CommandRow} row
 * @param {unknown} result
 */
function renderResult(ctx, row, result) {
  const c = colorsFor(ctx);
  const records = asRecords(result);
  if (records.length && row.columns) {
    ctx.stdout.write(`${formatTable(records, row.columns, c)}\n`);
    return;
  }
  if (result && typeof result === "object" && !Array.isArray(result)) {
    ctx.stdout.write(`${formatSummary(/** @type {Record<string, unknown>} */ (result), c)}\n`);
    return;
  }
  writeJson(ctx.stdout, result);
}

/**
 * @param {Record<string, any>} values
 * @param {any} ctx
 * @param {{ team: boolean }} opts
 * @returns {Promise<{ apiKey: string, teamId?: string, clusterId?: string, baseUrl: string }>}
 */
async function credentials(values, ctx, opts) {
  const file = await readConfig(ctx.env, ctx.configDir);
  const creds = resolveCredentials(values, ctx.env, file);
  if (!creds.apiKey) {
    throw new UsageError("Missing API key. Run postshiba login or set POSTSHIBA_API_KEY.");
  }
  if (opts.team && !creds.teamId) {
    throw new UsageError("Missing team id. Pass --team, set POSTSHIBA_TEAM_ID, or save one with postshiba login.");
  }
  return { apiKey: creds.apiKey, teamId: creds.teamId, clusterId: creds.clusterId, baseUrl: creds.baseUrl };
}
