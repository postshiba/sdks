// @ts-check

/**
 * @typedef {object} CommandRow
 * @property {string} resource
 * @property {string} action
 * @property {string} method
 * @property {string} path
 * @property {boolean} team
 * @property {string[]} ids
 * @property {boolean} data
 * @property {boolean} destructive
 * @property {boolean} binary
 * @property {string[]} [columns]
 */

/**
 * @param {string} resource
 * @param {string} action
 * @param {string} method
 * @param {string} path
 * @param {{ data?: boolean, binary?: boolean, columns?: string[] }} [extra]
 * @returns {CommandRow}
 */
function row(resource, action, method, path, extra = {}) {
  return {
    resource,
    action,
    method,
    path,
    team: path.includes(":teamId"),
    ids: pathParamNames(path),
    data: extra.data ?? false,
    destructive: /^(delete|suspend|release|unassign)/.test(action),
    binary: extra.binary ?? false,
    columns: extra.columns,
  };
}

/** @type {CommandRow[]} */
export const commands = [
  row("clusters", "list", "GET", "/api/v1/teams/:teamId/clusters", {
    columns: ["id", "name", "status", "plan", "sending_ready"],
  }),
  row("clusters", "get", "GET", "/api/v1/clusters/:id"),
  row("clusters", "create", "POST", "/api/v1/teams/:teamId/clusters", { data: true }),
  row("clusters", "update", "PATCH", "/api/v1/clusters/:id", { data: true }),
  row("clusters", "suspend", "POST", "/api/v1/clusters/:id/suspend"),
  row("clusters", "resume", "POST", "/api/v1/clusters/:id/resume"),
  row("clusters", "delete", "DELETE", "/api/v1/clusters/:id"),
  row("clusters", "boost", "POST", "/api/v1/clusters/:id/boost", { data: true }),
  row("clusters", "extend-boost", "POST", "/api/v1/clusters/:id/extend_boost", { data: true }),
  row("clusters", "cancel-boost", "POST", "/api/v1/clusters/:id/cancel_boost"),
  row("network", "list", "GET", "/api/v1/teams/:teamId/network", {
    columns: ["id", "address", "status", "kind", "classification"],
  }),
  row("network", "create", "POST", "/api/v1/teams/:teamId/network", { data: true }),
  row("network", "assign", "POST", "/api/v1/teams/:teamId/network/assign", { data: true }),
  row("network", "unassign", "POST", "/api/v1/teams/:teamId/network/unassign", { data: true }),
  row("network", "switch", "POST", "/api/v1/teams/:teamId/network/switch", { data: true }),
  row("network", "release", "POST", "/api/v1/teams/:teamId/network/release", { data: true }),
  row("sending-domains", "list", "GET", "/api/v1/teams/:teamId/sending_domains", {
    columns: ["id", "name", "dkim_status", "return_path_status", "primary"],
  }),
  row("sending-domains", "get", "GET", "/api/v1/sending_domains/:id"),
  row("sending-domains", "create", "POST", "/api/v1/teams/:teamId/sending_domains", { data: true }),
  row("sending-domains", "update", "PATCH", "/api/v1/sending_domains/:id", { data: true }),
  row("sending-domains", "refresh", "POST", "/api/v1/sending_domains/:id/refresh"),
  row("sending-domains", "verify", "POST", "/api/v1/sending_domains/:id/verify"),
  row("sending-domains", "suspend", "POST", "/api/v1/sending_domains/:id/suspend"),
  row("sending-domains", "resume", "POST", "/api/v1/sending_domains/:id/resume"),
  row("sending-domains", "make-primary", "POST", "/api/v1/sending_domains/:id/make_primary"),
  row("sending-domains", "delete", "DELETE", "/api/v1/sending_domains/:id"),
  row("tenants", "list", "GET", "/api/v1/teams/:teamId/tenants", {
    columns: ["id", "name", "slug", "suspended"],
  }),
  row("tenants", "get", "GET", "/api/v1/tenants/:id"),
  row("tenants", "create", "POST", "/api/v1/teams/:teamId/tenants", { data: true }),
  row("tenants", "delete", "DELETE", "/api/v1/tenants/:id"),
  row("inboxes", "list", "GET", "/api/v1/teams/:teamId/inboxes", {
    columns: ["id", "name", "address", "mx_status"],
  }),
  row("inboxes", "get", "GET", "/api/v1/inboxes/:id"),
  row("inboxes", "create", "POST", "/api/v1/teams/:teamId/inboxes", { data: true }),
  row("inboxes", "verify", "POST", "/api/v1/inboxes/:id/verify"),
  row("inboxes", "delete", "DELETE", "/api/v1/inboxes/:id"),
  row("messages", "list", "GET", "/api/v1/inboxes/:inboxId/inbound_messages", {
    columns: ["id", "from", "subject", "drain_status"],
  }),
  row("messages", "get", "GET", "/api/v1/inboxes/:inboxId/inbound_messages/:id"),
  row("messages", "download-attachment", "GET", "/api/v1/inboxes/:inboxId/inbound_messages/:id/attachments/:index", {
    binary: true,
  }),
  row("events", "list-team", "GET", "/api/v1/teams/:teamId/message_events", {
    columns: ["id", "event_type", "recipient", "occurred_at"],
  }),
  row("events", "list", "GET", "/api/v1/teams/:teamId/clusters/:clusterId/message_events", {
    columns: ["id", "event_type", "recipient", "occurred_at"],
  }),
  row("events", "get", "GET", "/api/v1/message_events/:id"),
  row("smtp-credentials", "create", "POST", "/api/v1/teams/:teamId/clusters/:clusterId/smtp_credentials", {
    data: true,
  }),
  row("smtp-credentials", "delete", "DELETE", "/api/v1/teams/:teamId/clusters/:clusterId/smtp_credentials/:id"),
  row("webhooks", "list", "GET", "/api/v1/teams/:teamId/webhook_endpoints", {
    columns: ["id", "url", "enabled"],
  }),
  row("webhooks", "get", "GET", "/api/v1/webhook_endpoints/:id"),
  row("webhooks", "create", "POST", "/api/v1/teams/:teamId/webhook_endpoints", { data: true }),
  row("webhooks", "update", "PATCH", "/api/v1/webhook_endpoints/:id", { data: true }),
  row("webhooks", "delete", "DELETE", "/api/v1/webhook_endpoints/:id"),
  row("templates", "list", "GET", "/api/v1/teams/:teamId/templates", {
    columns: ["id", "name", "alias", "published"],
  }),
  row("templates", "get", "GET", "/api/v1/templates/:id"),
  row("templates", "create", "POST", "/api/v1/teams/:teamId/templates", { data: true }),
  row("templates", "update", "PATCH", "/api/v1/templates/:id", { data: true }),
  row("templates", "publish", "POST", "/api/v1/templates/:id/publish"),
  row("templates", "duplicate", "POST", "/api/v1/templates/:id/duplicate"),
  row("templates", "delete", "DELETE", "/api/v1/templates/:id"),
  row("suppressions", "list", "GET", "/api/v1/teams/:teamId/suppressions", {
    columns: ["id", "email", "reason", "tenant"],
  }),
  row("suppressions", "create", "POST", "/api/v1/teams/:teamId/suppressions", { data: true }),
  row("suppressions", "import", "POST", "/api/v1/teams/:teamId/suppressions/import", { data: true }),
  row("suppressions", "delete", "DELETE", "/api/v1/suppressions/:id"),
  row("firewall", "get", "GET", "/api/v1/teams/:teamId/firewall"),
  row("firewall", "update", "PATCH", "/api/v1/teams/:teamId/firewall", { data: true }),
  row("firewall", "add-entry", "POST", "/api/v1/teams/:teamId/firewall_entries", { data: true }),
  row("firewall", "delete-entry", "DELETE", "/api/v1/firewall_entries/:id"),
];

/**
 * @param {string} name
 */
export function kebab(name) {
  return name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}

/**
 * @param {string} resource
 * @param {string} action
 */
export function findCommand(resource, action) {
  return commands.find((item) => item.resource === resource && item.action === action);
}

export function resources() {
  return [...new Set(commands.map((item) => item.resource))];
}

/**
 * @param {string} resource
 */
export function actionsFor(resource) {
  return commands.filter((item) => item.resource === resource);
}

/**
 * @param {string} path
 */
export function pathParamNames(path) {
  return [...path.matchAll(/:([A-Za-z]+)/g)].map((match) => match[1]).filter((name) => name !== "teamId");
}

/**
 * @param {string} path
 * @param {Record<string, string | undefined>} params
 */
export function interpolatePath(path, params) {
  return path.replace(/:([A-Za-z]+)/g, (_, name) => {
    const value = params[name];
    if (value === undefined || value === null || value === "") {
      throw new Error(`missing path param :${name}`);
    }
    const text = String(value);
    return /[^A-Za-z0-9._~-]/.test(text) ? encodeURIComponent(text) : text;
  });
}

/**
 * @param {CommandRow} item
 */
export function actionUsage(item) {
  const ids = item.ids.map((name) => `<${name}>`);
  const parts = [item.action, ...ids];
  if (item.data) parts.push("--data");
  if (item.binary) parts.push("[--output PATH]");
  return parts.join(" ");
}
