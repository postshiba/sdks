// @ts-check

import { actionUsage, actionsFor, commands, resources } from "./commands.js";
import { VERSION } from "./pkg.js";

/**
 * @param {string} [topic]
 */
export function formatHelp(topic) {
  if (!topic) return generalHelp();
  if (topic === "send") return sendHelp();
  if (topic === "login" || topic === "logout" || topic === "whoami") return generalHelp();
  if (topic === "doctor") return "Usage: postshiba doctor [--json]";
  if (topic === "skills") return "Usage: postshiba skills install [--global] [--target cursor|claude|agents]";
  const rows = actionsFor(topic);
  if (rows.length === 0) return "";
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
    `postshiba ${VERSION}`,
    "",
    "Usage: postshiba <command>",
    "",
    "Commands:",
    "  login                 Sign in and write the local config file",
    "  logout                Remove the local config file",
    "  whoami                Print the signed-in user",
    "  send                  Send an email",
    "  doctor                Check key, team, cluster, and domain",
    "  skills install        Copy the agent skill into this project",
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
    "  --json                Print API JSON. Never prompt.",
    "  --no-input            Plain mode. Never prompt.",
    "  --yes                 Skip confirm for delete, suspend, release, unassign",
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
