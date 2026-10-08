// @ts-check

import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_BASE_URL = "https://app.postshiba.com";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [configDir]
 */
export function resolveConfigDir(env = {}, configDir) {
  if (configDir) return configDir;
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, "postshiba");
  const home = env.HOME ?? env.USERPROFILE;
  if (!home) throw new Error("HOME or XDG_CONFIG_HOME is required");
  return join(home, ".config", "postshiba");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [configDir]
 */
export function configFilePath(env, configDir) {
  return join(resolveConfigDir(env, configDir), "config.json");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [configDir]
 * @returns {Promise<Record<string, string>>}
 */
export async function readConfig(env, configDir) {
  try {
    return JSON.parse(await readFile(configFilePath(env, configDir), "utf8"));
  } catch (err) {
    if (err && /** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT") return {};
    throw err;
  }
}

/**
 * @param {NodeJS.ProcessEnv | undefined} env
 * @param {string | undefined} configDir
 * @param {Record<string, string>} data
 */
export async function writeConfig(env, configDir, data) {
  const dir = resolveConfigDir(env, configDir);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "config.json");
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  // writeFile mode is umask-masked; chmod is what makes 0600 stick.
  await chmod(file, 0o600);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [configDir]
 */
export async function removeConfig(env, configDir) {
  try {
    await rm(configFilePath(env, configDir));
  } catch (err) {
    if (!err || /** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT") throw err;
  }
}

/**
 * @param {Record<string, unknown>} values
 * @param {NodeJS.ProcessEnv} env
 * @param {Record<string, string>} file
 */
export function resolveCredentials(values, env, file) {
  const apiKey = first(values["api-key"], env.POSTSHIBA_API_KEY, file.api_key);
  const teamId = first(values.team, env.POSTSHIBA_TEAM_ID, file.team_id);
  const clusterId = first(values.cluster, env.POSTSHIBA_CLUSTER_ID, file.cluster_id);
  const baseUrl = String(
    first(values["base-url"], env.POSTSHIBA_BASE_URL, file.base_url) ?? DEFAULT_BASE_URL,
  ).replace(/\/$/, "");
  return { apiKey, teamId, clusterId, baseUrl };
}

/**
 * @param {...unknown} values
 */
function first(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return /** @type {string} */ (value);
  }
  return undefined;
}
