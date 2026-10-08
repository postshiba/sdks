// @ts-check

export class UsageError extends Error {
  /**
   * @param {string} message
   * @param {{ helpResource?: string }} [opts]
   */
  constructor(message, opts = {}) {
    super(message);
    this.name = "UsageError";
    this.helpResource = opts.helpResource;
  }
}

export class CancelError extends Error {
  constructor(message = "Cancelled.") {
    super(message);
    this.name = "CancelError";
  }
}

/**
 * @param {{ write: (chunk: string) => unknown }} stderr
 * @param {{ message: string, field?: string | null, status?: number | null, error?: string }} err
 */
export function writeApiError(stderr, err) {
  let line = `Error: ${err.message}`;
  if (err.field) line += ` (field: ${err.field})`;
  stderr.write(`${line}\n`);
  if (err.status === 429 && err.error === "throttled") {
    stderr.write("The cluster hit its hourly send limit. Wait until the next hour before retrying.\n");
  }
}
