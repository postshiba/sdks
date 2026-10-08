import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { runCli } from "../support.js";

const cliSkill = join(dirname(fileURLToPath(import.meta.url)), "../skills/postshiba-cli/SKILL.md");
const pluginSkill = join(dirname(fileURLToPath(import.meta.url)), "../../skills/skills/postshiba-cli/SKILL.md");

describe("skills", () => {
  it("keeps the CLI skill byte-identical to the plugin skill", () => {
    assert.ok(existsSync(cliSkill));
    assert.ok(existsSync(pluginSkill));
    assert.equal(readFileSync(cliSkill, "utf8"), readFileSync(pluginSkill, "utf8"));
  });

  it("writes the skill into .cursor/skills/postshiba-cli by default", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "postshiba-cli-skill-"));
    const result = await runCli(["skills", "install"], { cwd, env: {} });
    assert.equal(result.code, 0, result.stderr);
    const dest = join(cwd, ".cursor/skills/postshiba-cli/SKILL.md");
    assert.equal(result.stdout, `${dest}\n`);
    assert.equal(await readFile(dest, "utf8"), readFileSync(cliSkill, "utf8"));
  });

  it("writes --target claude and --global under home", async () => {
    const home = await mkdtemp(join(tmpdir(), "postshiba-cli-home-"));
    const result = await runCli(["skills", "install", "--global", "--target", "claude"], {
      home,
      env: { HOME: home },
    });
    assert.equal(result.code, 0);
    const dest = join(home, ".claude/skills/postshiba-cli/SKILL.md");
    assert.equal(result.stdout, `${dest}\n`);
    assert.equal(await readFile(dest, "utf8"), readFileSync(cliSkill, "utf8"));
  });
});
