// @ts-check

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { UsageError } from "./errors.js";
import { SKILL_FILE } from "./pkg.js";

const TARGETS = {
  cursor: ".cursor/skills/postshiba-cli/SKILL.md",
  claude: ".claude/skills/postshiba-cli/SKILL.md",
  agents: ".agents/skills/postshiba-cli/SKILL.md",
};

/**
 * @param {Record<string, any>} values
 * @param {object} ctx
 * @param {NodeJS.ProcessEnv} ctx.env
 * @param {string} [ctx.cwd]
 * @param {string} [ctx.home]
 * @param {{ write: (chunk: string) => unknown }} ctx.stdout
 */
export async function installSkill(values, ctx) {
  const targetName = values.target ?? "cursor";
  const rel = TARGETS[/** @type {keyof typeof TARGETS} */ (targetName)];
  if (!rel) {
    throw new UsageError("Unknown --target. Use cursor, claude, or agents.", { helpResource: "skills" });
  }
  const root = values.global
    ? (ctx.home ?? ctx.env.HOME ?? ctx.env.USERPROFILE)
    : (ctx.cwd ?? process.cwd());
  if (!root) throw new UsageError("Missing home directory for --global.");
  const dest = join(root, rel);
  await mkdir(dirname(dest), { recursive: true });
  const body = await readFile(SKILL_FILE);
  await writeFile(dest, body);
  ctx.stdout.write(`${dest}\n`);
  return 0;
}

export { TARGETS };
