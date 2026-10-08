// @ts-check

/**
 * One decision at the process boundary. Interactive only when both
 * streams are TTYs, --json/--no-input are absent, and CI is unset.
 *
 * @param {{ json?: boolean, "no-input"?: boolean }} flags
 * @param {{ env?: NodeJS.ProcessEnv, isTTY?: boolean, stdin?: { isTTY?: boolean }, stdout?: { isTTY?: boolean } }} io
 */
export function isInteractive(flags, io) {
  if (flags.json || flags["no-input"]) return false;
  if (io.env && io.env.CI) return false;
  if (io.isTTY === false) return false;
  if (io.isTTY === true) return true;
  return Boolean(io.stdin && io.stdin.isTTY && io.stdout && io.stdout.isTTY);
}
