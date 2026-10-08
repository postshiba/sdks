// @ts-check

export class PostShibaError extends Error {
  /**
   * @param {{ error?: string, field?: string | null, message?: string, status?: number | null }} [attrs]
   */
  constructor(attrs = {}) {
    super(attrs.message ?? attrs.error ?? "Request failed");
    this.name = "PostShibaError";
    this.error = attrs.error ?? "error";
    this.field = attrs.field ?? null;
    this.status = attrs.status ?? null;
  }
}

/**
 * @param {string} text
 * @returns {unknown}
 */
function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.method
 * @param {string} opts.url
 * @param {string} opts.apiKey
 * @param {unknown} [opts.body]
 * @param {Record<string, string>} [opts.headers]
 * @param {boolean} [opts.binary]
 * @param {typeof fetch} [opts.fetch]
 */
export async function request(opts) {
  /** @type {Record<string, string>} */
  const headers = {
    Authorization: `Bearer ${opts.apiKey}`,
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const fetchImpl = opts.fetch ?? globalThis.fetch;
  let res;
  try {
    res = await fetchImpl(opts.url, {
      method: opts.method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PostShibaError({ error: "network", message });
  }

  if (!res.ok) {
    const payload = parseJson(await res.text());
    const attrs = payload && typeof payload === "object" ? /** @type {Record<string, unknown>} */ (payload) : {};
    throw new PostShibaError({
      error: typeof attrs.error === "string" ? attrs.error : undefined,
      field: typeof attrs.field === "string" ? attrs.field : null,
      message: typeof attrs.message === "string" ? attrs.message : undefined,
      status: res.status,
    });
  }

  if (opts.binary) return Buffer.from(await res.arrayBuffer());
  return parseJson(await res.text());
}
