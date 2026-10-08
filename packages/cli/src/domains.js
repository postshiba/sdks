// @ts-check

import { request } from "./client.js";
import { interpolatePath } from "./commands.js";
import { colorsFor, domainDnsRows, domainVerified, formatTable } from "./render.js";

const VERIFY_MS = 10_000;
const VERIFY_LIMIT_MS = 5 * 60 * 1000;

/**
 * @param {object} ctx
 * @param {boolean} ctx.interactive
 * @param {import("./prompts.js").Prompts} [ctx.prompts]
 * @param {typeof fetch} ctx.fetch
 * @param {{ write: (chunk: string) => unknown }} ctx.stdout
 * @param {NodeJS.ProcessEnv} ctx.env
 * @param {boolean} [ctx.isTTY]
 * @param {(ms: number) => Promise<void>} [ctx.sleep]
 * @param {{ apiKey: string, teamId: string, baseUrl: string }} creds
 */
export async function createSendingDomainWizard(ctx, creds) {
  if (!ctx.prompts) throw new Error("prompts required");
  const name = await ctx.prompts.text({
    message: "Domain",
    placeholder: "mail.example.com",
  });
  const path = interpolatePath("/api/v1/teams/:teamId/sending_domains", { teamId: creds.teamId });
  const spin = ctx.prompts.spinner();
  spin.start("Creating sending domain");
  const created = /** @type {Record<string, unknown>} */ (
    await request({
      method: "POST",
      url: `${creds.baseUrl}${path}`,
      apiKey: creds.apiKey,
      body: { name },
      fetch: ctx.fetch,
    })
  );
  spin.stop(`Created ${created.name ?? name}`);

  const c = colorsFor(ctx);
  const rows = domainDnsRows(created);
  if (rows.length) {
    ctx.stdout.write(`${formatTable(rows, ["type", "name", "value"], c)}\n`);
  }

  const wait = await ctx.prompts.confirm({ message: "Wait for verification?" });
  if (!wait) return created;

  const id = String(created.id ?? "");
  const verifyPath = interpolatePath("/api/v1/sending_domains/:id/verify", { id });
  const started = Date.now();
  const sleep = ctx.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const watch = ctx.prompts.spinner();
  watch.start("Waiting for DNS");
  let latest = created;
  while (Date.now() - started < VERIFY_LIMIT_MS) {
    latest = /** @type {Record<string, unknown>} */ (
      await request({
        method: "POST",
        url: `${creds.baseUrl}${verifyPath}`,
        apiKey: creds.apiKey,
        fetch: ctx.fetch,
      })
    );
    if (domainVerified(latest)) {
      watch.stop("Verified");
      return latest;
    }
    await sleep(VERIFY_MS);
  }
  watch.stop("Still pending");
  return latest;
}
