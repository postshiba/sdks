import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_BASE_URL = "https://app.postshiba.com";

export function resolveConfigDir(env = {}, configDir) {
  if (configDir) return configDir;
  if (env.XDG_CONFIG_HOME) return join(env.XDG_CONFIG_HOME, "postshiba");
  const home = env.HOME ?? env.USERPROFILE;
  if (!home) throw new Error("HOME or XDG_CONFIG_HOME is required");
  return join(home, ".config", "postshiba");
}

export function configFilePath(env, configDir) {
  return join(resolveConfigDir(env, configDir), "config.json");
}

export async function readConfig(env, configDir) {
  try {
    return JSON.parse(await readFile(configFilePath(env, configDir), "utf8"));
  } catch (err) {
    if (err && err.code === "ENOENT") return {};
    throw err;
  }
}

export async function writeConfig(env, configDir, data) {
  const dir = resolveConfigDir(env, configDir);
  await mkdir(dir, { recursive: true });
  const file = join(dir, "config.json");
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  // writeFile mode is umask-masked; chmod is what makes 0600 stick.
  await chmod(file, 0o600);
}

export async function removeConfig(env, configDir) {
  try {
    await rm(configFilePath(env, configDir));
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
}

export function resolveCredentials(values, env, file) {
  const apiKey = first(values["api-key"], env.POSTSHIBA_API_KEY, file.api_key);
  const teamId = first(values.team, env.POSTSHIBA_TEAM_ID, file.team_id);
  const baseUrl = (first(values["base-url"], env.POSTSHIBA_BASE_URL, file.base_url) ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    "",
  );
  return { apiKey, teamId, baseUrl };
}

function first(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}
