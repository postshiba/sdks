// @ts-check

import { createColors } from "picocolors";

/** @typedef {ReturnType<typeof createColors>} Palette */

const SECRET_KEYS = new Set(["dkim_private_key", "provider_resources"]);
const STATUS_KEYS = new Set([
  "status",
  "desired_status",
  "dkim_status",
  "return_path_status",
  "dmarc_status",
  "mx_status",
  "drain_status",
]);

/**
 * @param {{ env?: NodeJS.ProcessEnv, stdout?: { isTTY?: boolean, write?: (chunk: string) => unknown }, isTTY?: boolean, interactive?: boolean }} io
 */
export function colorsFor(io) {
  const env = io.env ?? {};
  if (env.FORCE_COLOR) return createColors(true);
  if (env.NO_COLOR) return createColors(false);
  return createColors(Boolean(io.interactive || io.isTTY || (io.stdout && io.stdout.isTTY)));
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEYS.has(key)) continue;
      out[key] = redact(item);
    }
    return out;
  }
  return value;
}

/**
 * @param {{ write: (chunk: string) => unknown }} stdout
 * @param {unknown} value
 */
export function writeJson(stdout, value) {
  stdout.write(`${JSON.stringify(redact(value), null, 2)}\n`);
}

/**
 * @param {Palette} c
 */
export function wordmark(c) {
  const letters = ["p", "o", "s", "t", "s", "h", "i", "b", "a"];
  const paints = [c.cyan, c.magenta, c.yellow, c.green, c.blue, c.cyan, c.magenta, c.yellow, c.green];
  const title = letters.map((ch, i) => paints[i % paints.length](c.bold(ch))).join(" ");
  const line = c.dim("─".repeat(21));
  return [`  ${c.dim("╭")} ${title} ${c.dim("╮")}`, `  ${line}`, `  ${c.dim("mail from the terminal")}`].join("\n");
}

/**
 * @param {unknown} value
 * @param {string} key
 * @param {Palette} c
 */
export function paintStatus(value, key, c) {
  const text = value === null || value === undefined ? "" : String(value);
  if (key === "sending_ready") return value ? c.green("ready") : c.red("not ready");
  if (key === "enabled" || key === "published" || key === "primary") {
    if (value === true) return c.green(text);
    if (value === false) return c.dim(text);
  }
  if (key === "suspended") return value ? c.red("suspended") : c.green("active");
  const lower = text.toLowerCase();
  if (["ready", "verified", "active", "delivered", "pass"].includes(lower)) return c.green(text);
  if (["pending", "not_required"].includes(lower)) return c.yellow(text);
  if (["failed", "suspended", "bounce", "dropped"].includes(lower)) return c.red(text);
  if (STATUS_KEYS.has(key)) return c.yellow(text);
  return text;
}

/**
 * @param {unknown} value
 */
function cell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/**
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} columns
 * @param {Palette} c
 */
export function formatTable(rows, columns, c) {
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((item) => cell(item[col]).length)),
  );
  const header = columns.map((col, i) => c.dim(col.toUpperCase().padEnd(widths[i] ?? 0))).join("  ");
  const lines = [header];
  for (const item of rows) {
    lines.push(
      columns
        .map((col, i) => {
          const raw = cell(item[col]);
          const painted = paintStatus(item[col], col, c);
          const pad = (widths[i] ?? 0) - raw.length;
          return painted + " ".repeat(Math.max(0, pad));
        })
        .join("  "),
    );
  }
  return lines.join("\n");
}

/**
 * @param {Record<string, unknown>} value
 * @param {Palette} c
 */
export function formatSummary(value, c) {
  const cleaned = /** @type {Record<string, unknown>} */ (redact(value));
  const keys = Object.keys(cleaned);
  const width = Math.max(0, ...keys.map((key) => key.length));
  return keys
    .map((key) => {
      const raw = cleaned[key];
      const display =
        raw && typeof raw === "object" ? JSON.stringify(raw) : paintStatus(raw, key, c);
      return `  ${c.dim(key.padEnd(width))}  ${display}`;
    })
    .join("\n");
}

/**
 * @param {unknown} value
 */
export function asRecords(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  return [];
}

/**
 * @param {unknown} domain
 */
export function domainDnsRows(domain) {
  if (!domain || typeof domain !== "object") return [];
  const d = /** @type {Record<string, unknown>} */ (domain);
  /** @type {{ type: string, name: string, value: string }[]} */
  const rows = [];
  if (d.dkim_cname_host && d.dkim_cname_target) {
    rows.push({ type: "CNAME", name: String(d.dkim_cname_host), value: String(d.dkim_cname_target) });
  }
  if (d.dkim_manual && d.dkim_txt && d.dkim_cname_host) {
    rows.push({ type: "TXT", name: String(d.dkim_cname_host), value: String(d.dkim_txt) });
  }
  if (d.return_path_host && d.return_path_target) {
    rows.push({ type: "CNAME", name: String(d.return_path_host), value: String(d.return_path_target) });
  }
  if (d.dmarc_host && d.dmarc_record) {
    rows.push({ type: "TXT", name: String(d.dmarc_host), value: String(d.dmarc_record) });
  }
  return rows;
}

/**
 * @param {unknown} domain
 */
export function domainVerified(domain) {
  if (!domain || typeof domain !== "object") return false;
  const d = /** @type {Record<string, unknown>} */ (domain);
  return d.dkim_status === "verified" && d.return_path_status === "verified";
}
