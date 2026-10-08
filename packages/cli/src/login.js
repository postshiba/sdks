// @ts-check

import { request } from "./client.js";
import { readConfig, removeConfig, writeConfig } from "./config.js";
import { UsageError } from "./errors.js";
import { spinning } from "./prompts.js";

/**
 * @param {Record<string, any>} values
 * @param {object} ctx
 * @param {NodeJS.ProcessEnv} ctx.env
 * @param {string} [ctx.configDir]
 * @param {typeof fetch} ctx.fetch
 * @param {{ write: (chunk: string) => unknown }} ctx.stdout
 * @param {boolean} ctx.interactive
 * @param {import("./prompts.js").Prompts} [ctx.prompts]
 */
export async function login(values, ctx) {
  let apiKey = values["api-key"] || ctx.env.POSTSHIBA_API_KEY;
  if (!apiKey && ctx.interactive && ctx.prompts) {
    apiKey = await ctx.prompts.password({ message: "API key" });
  }
  if (!apiKey) {
    throw new UsageError("Missing API key. Run postshiba login or set POSTSHIBA_API_KEY.");
  }

  let teamId = values.team || ctx.env.POSTSHIBA_TEAM_ID;
  const baseUrl = (values["base-url"] || ctx.env.POSTSHIBA_BASE_URL || "https://app.postshiba.com").replace(/\/$/, "");

  const me = /** @type {{ email?: string }} */ (
    await spinning(
      ctx.interactive ? ctx.prompts : null,
      "Checking key",
      () => request({ method: "GET", url: `${baseUrl}/api/v1/users/me`, apiKey, fetch: ctx.fetch }),
      (user) => `Signed in as ${/** @type {{ email?: string }} */ (user).email ?? "unknown"}`,
    )
  );

  if (!teamId && ctx.interactive && ctx.prompts) {
    teamId = await ctx.prompts.text({
      message: "Team id",
      placeholder: "on the API keys page",
    });
  }

  /** @type {Record<string, string>} */
  const saved = { api_key: apiKey };
  if (teamId) saved.team_id = teamId;
  if (values["base-url"] || ctx.env.POSTSHIBA_BASE_URL) saved.base_url = baseUrl;

  if (teamId && ctx.interactive && ctx.prompts) {
    const clusters = await listClusters(baseUrl, apiKey, teamId, ctx.fetch);
    if (clusters.length === 1) saved.cluster_id = String(clusters[0].id);
    else if (clusters.length > 1) {
      saved.cluster_id = await ctx.prompts.select({
        message: "Default cluster",
        options: clusters.map((item) => ({
          value: String(item.id),
          label: String(item.name ?? item.id),
        })),
      });
    }
  }

  await writeConfig(ctx.env, ctx.configDir, saved);
  ctx.stdout.write(`Signed in as ${me.email}\n`);
  return 0;
}

/**
 * @param {object} ctx
 * @param {NodeJS.ProcessEnv} ctx.env
 * @param {string} [ctx.configDir]
 * @param {boolean} ctx.interactive
 * @param {import("./prompts.js").Prompts} [ctx.prompts]
 */
export async function logout(ctx) {
  await removeConfig(ctx.env, ctx.configDir);
  if (ctx.interactive && ctx.prompts) ctx.prompts.outro("Signed out.");
  return 0;
}

/**
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {string} teamId
 * @param {typeof fetch} fetchImpl
 */
async function listClusters(baseUrl, apiKey, teamId, fetchImpl) {
  const body = await request({
    method: "GET",
    url: `${baseUrl}/api/v1/teams/${teamId}/clusters`,
    apiKey,
    fetch: fetchImpl,
  });
  return Array.isArray(body) ? body.filter((item) => item && typeof item === "object") : [];
}

/**
 * @param {object} ctx
 * @param {NodeJS.ProcessEnv} ctx.env
 * @param {string} [ctx.configDir]
 */
export async function hasSavedKey(ctx) {
  const file = await readConfig(ctx.env, ctx.configDir);
  return Boolean(file.api_key);
}
