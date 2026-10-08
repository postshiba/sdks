// @ts-check

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { UsageError } from "./errors.js";
import { domainVerified } from "./render.js";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".csv": "text/csv",
};

/**
 * @param {AsyncIterable<string | Uint8Array>} stdin
 */
export async function readStream(stdin) {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
  }
  return chunks.join("");
}

/**
 * @param {string} raw
 * @param {AsyncIterable<string | Uint8Array>} stdin
 */
export async function loadData(raw, stdin) {
  let text;
  if (raw === "-") text = await readStream(stdin);
  else if (raw.startsWith("@")) text = await readFile(raw.slice(1), "utf8");
  else text = raw;
  try {
    return JSON.parse(text);
  } catch {
    throw new UsageError("Invalid JSON for --data");
  }
}

/**
 * @param {Record<string, any>} values
 * @param {AsyncIterable<string | Uint8Array>} stdin
 */
export async function buildSendBody(values, stdin) {
  const body = values.data !== undefined ? await loadData(values.data, stdin) : {};
  if (values.from) body.from = values.from;
  if (values.to) body.to = values.to;
  if (values.cc) body.cc = values.cc;
  if (values.bcc) body.bcc = values.bcc;
  if (values["reply-to"]) body.reply_to = values["reply-to"];
  if (values.subject) body.subject = values.subject;
  if (values.text !== undefined) body.text = values.text;
  if (values["text-file"]) body.text = await readFile(values["text-file"], "utf8");
  if (values.html !== undefined) body.html = values.html;
  if (values["html-file"]) body.html = await readFile(values["html-file"], "utf8");

  const usingTemplate = Boolean(values.template || body.template);
  if (values.template) {
    body.template = {
      id: values.template,
      variables: { ...(body.template && body.template.variables), ...pairs(values.var) },
    };
    delete body.html;
    delete body.text;
  } else if (values.var) {
    body.template = {
      ...(body.template ?? {}),
      variables: { ...(body.template && body.template.variables), ...pairs(values.var) },
    };
  }

  if (values.header) body.headers = { ...body.headers, ...headers(values.header) };
  if (values.arg) body.unique_args = { ...body.unique_args, ...pairs(values.arg) };
  if (values.attach) {
    body.attachments = [];
    for (const file of values.attach) {
      const buf = await readFile(file);
      body.attachments.push({
        filename: basename(file),
        content_type: MIME[/** @type {keyof typeof MIME} */ (extname(file).toLowerCase())] || "application/octet-stream",
        content: buf.toString("base64"),
      });
    }
  }
  if (values.tenant) body.tenant = values.tenant;

  if (!usingTemplate) {
    if (body.cc === undefined) body.cc = [];
    if (body.bcc === undefined) body.bcc = [];
  }

  if (!body.from || !hasRecipients(body.to)) {
    throw new UsageError("send requires --from and at least one --to", { helpResource: "send" });
  }
  return body;
}

/**
 * @param {Record<string, any>} values
 * @param {string} [clusterId]
 */
export function sendRoute(values, clusterId) {
  const sandbox = Boolean(values.sandbox);
  const idempotencyKey = values["idempotency-key"];
  const id = values.cluster ?? clusterId;
  // Cluster-path send is for sandbox or idempotent replay; --cluster alone stays on /emails.
  if (sandbox || idempotencyKey) {
    if (!id) {
      throw new UsageError(
        sandbox
          ? "Missing --cluster. --sandbox requires --cluster."
          : "Missing --cluster. --idempotency-key requires --cluster.",
        { helpResource: "send" },
      );
    }
    return {
      path: "/api/v1/teams/:teamId/clusters/:clusterId/sends",
      team: true,
      clusterId: id,
      sandbox,
      idempotencyKey,
    };
  }
  return {
    path: "/api/v1/emails",
    team: false,
    clusterId: id,
    sandbox: false,
    idempotencyKey: undefined,
  };
}

/**
 * @param {Record<string, any>} values
 * @param {object} ctx
 * @param {import("./prompts.js").Prompts} ctx.prompts
 * @param {(method: string, path: string) => Promise<unknown>} ctx.api
 * @param {{ clusterId?: string, teamId?: string }} creds
 */
export async function completeSendFlags(values, ctx, creds) {
  const next = { ...values };
  if (!next.from) {
    const domains = asList(await ctx.api("GET", `/api/v1/teams/${creds.teamId}/sending_domains`)).filter(domainVerified);
    const suggestion = domains[0] && typeof domains[0].name === "string" ? `hello@${domains[0].name}` : undefined;
    next.from = await ctx.prompts.text({
      message: "From",
      placeholder: "hello@mail.example.com",
      defaultValue: suggestion,
    });
  }
  if (!next.to) {
    const raw = await ctx.prompts.text({ message: "To (comma separated)", placeholder: "you@example.com" });
    next.to = raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!next.subject && !next.template && !next.data) {
    next.subject = await ctx.prompts.text({ message: "Subject" });
  }
  if (!next.text && !next.html && !next.template && !next["html-file"] && !next["text-file"] && !next.data) {
    const kind = await ctx.prompts.select({
      message: "Body",
      options: [
        { value: "text", label: "Plain text" },
        { value: "html", label: "HTML file" },
        { value: "template", label: "Published template" },
      ],
    });
    if (kind === "text") next.text = await ctx.prompts.text({ message: "Text" });
    if (kind === "html") next["html-file"] = await ctx.prompts.text({ message: "HTML file path" });
    if (kind === "template") {
      const templates = asList(await ctx.api("GET", `/api/v1/teams/${creds.teamId}/templates`)).filter(
        (item) => item.published,
      );
      if (templates.length === 0) throw new UsageError("No published templates.", { helpResource: "send" });
      next.template = await ctx.prompts.select({
        message: "Template",
        options: templates.map((item) => ({
          value: String(item.alias ?? item.id),
          label: String(item.name ?? item.alias ?? item.id),
        })),
      });
      /** @type {string[]} */
      const vars = [];
      while (true) {
        const pair = await ctx.prompts.text({
          message: "Variable KEY=VALUE (blank to finish)",
          placeholder: "name=Ada",
        });
        if (!String(pair).trim()) break;
        vars.push(String(pair).trim());
      }
      if (vars.length) next.var = vars;
    }
  }
  if (!next.cluster) {
    if (creds.clusterId) next.cluster = creds.clusterId;
    else if (creds.teamId) {
      const clusters = asList(await ctx.api("GET", `/api/v1/teams/${creds.teamId}/clusters`));
      if (clusters.length === 1) next.cluster = String(clusters[0].id);
      else if (clusters.length > 1) {
        next.cluster = await ctx.prompts.select({
          message: "Cluster",
          options: clusters.map((item) => ({
            value: String(item.id),
            label: String(item.name ?? item.id),
          })),
        });
      }
    }
  }
  return next;
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ sandbox?: boolean, clusterId?: string }} route
 */
export function sendPreview(body, route) {
  const to = Array.isArray(body.to) ? body.to.join(", ") : String(body.to ?? "");
  const lines = [
    `From     ${body.from ?? ""}`,
    `To       ${to}`,
    `Subject  ${body.subject ?? (body.template ? `(template ${/** @type {{ id?: string }} */ (body.template).id})` : "")}`,
  ];
  if (route.clusterId) lines.push(`Cluster  ${route.clusterId}`);
  if (route.sandbox) lines.push("Sandbox  yes");
  return lines.join("\n");
}

/**
 * @param {unknown} value
 * @returns {Record<string, any>[]}
 */
function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

/**
 * @param {unknown} to
 */
function hasRecipients(to) {
  if (Array.isArray(to)) return to.length > 0;
  return Boolean(to);
}

/**
 * @param {string[] | undefined} items
 */
function pairs(items) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const item of items ?? []) {
    const at = item.indexOf("=");
    if (at === -1) throw new UsageError(`Expected KEY=VALUE, got ${item}`);
    out[item.slice(0, at)] = item.slice(at + 1);
  }
  return out;
}

/**
 * @param {string[] | undefined} items
 */
function headers(items) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const item of items ?? []) {
    const at = item.indexOf(":");
    if (at === -1) throw new UsageError(`Expected "Name: value", got ${item}`, { helpResource: "send" });
    out[item.slice(0, at).trim()] = item.slice(at + 1).trim();
  }
  return out;
}
