import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { UsageError } from "./client.js";

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

export async function readStream(stdin) {
  const chunks = [];
  for await (const chunk of stdin) {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
  }
  return chunks.join("");
}

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
        content_type: MIME[extname(file).toLowerCase()] || "application/octet-stream",
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

export function sendRoute(values) {
  const sandbox = Boolean(values.sandbox);
  const idempotencyKey = values["idempotency-key"];
  const clusterId = values.cluster;
  // Cluster-path send is for sandbox or idempotent replay; --cluster alone stays on /emails.
  if (sandbox || idempotencyKey) {
    if (!clusterId) {
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
      clusterId,
      sandbox,
      idempotencyKey,
    };
  }
  return {
    path: "/api/v1/emails",
    team: false,
    clusterId,
    sandbox: false,
    idempotencyKey: undefined,
  };
}

function hasRecipients(to) {
  if (Array.isArray(to)) return to.length > 0;
  return Boolean(to);
}

function pairs(items) {
  const out = {};
  for (const item of items ?? []) {
    const at = item.indexOf("=");
    if (at === -1) throw new UsageError(`Expected KEY=VALUE, got ${item}`);
    out[item.slice(0, at)] = item.slice(at + 1);
  }
  return out;
}

function headers(items) {
  const out = {};
  for (const item of items ?? []) {
    const at = item.indexOf(":");
    if (at === -1) throw new UsageError(`Expected "Name: value", got ${item}`, { helpResource: "send" });
    out[item.slice(0, at).trim()] = item.slice(at + 1).trim();
  }
  return out;
}
