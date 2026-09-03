import { createHmac, timingSafeEqual } from "node:crypto";

export type Id = number | string;
export type Json = Record<string, unknown>;

export type PostShibaOptions = {
  baseUrl?: string;
  teamId?: Id;
};

export type ClusterSendOptions = {
  idempotencyKey?: string;
  sandbox?: boolean;
};

export class PostShibaError extends Error {
  readonly error: string;
  readonly field: string | null;

  constructor(attrs: { error?: string; field?: string | null; message?: string }) {
    super(attrs.message ?? attrs.error ?? "Request failed");
    this.name = "PostShibaError";
    this.error = attrs.error ?? "error";
    this.field = attrs.field ?? null;
  }
}

function parseJson(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asErrorPayload(value: unknown): { error?: string; field?: string; message?: string } {
  if (value && typeof value === "object") return value as { error?: string; field?: string; message?: string };
  return {};
}

export class PostShiba {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly teamId?: Id;

  constructor(apiKey: string, options: PostShibaOptions = {}) {
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? "https://app.postshiba.com").replace(/\/$/, "");
    this.teamId = options.teamId;
  }

  private requireTeamId(): Id {
    if (this.teamId === undefined || this.teamId === null || this.teamId === "") {
      throw new Error("teamId is required");
    }
    return this.teamId;
  }

  private async request(
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string>; binary?: boolean; team?: boolean } = {},
  ): Promise<unknown> {
    const resolved = opts.team ? `/api/v1/teams/${this.requireTeamId()}${path}` : path;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
      ...opts.headers,
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`${this.baseUrl}${resolved}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    if (!res.ok) {
      const payload = asErrorPayload(parseJson(await res.text()));
      throw new PostShibaError({
        error: payload.error,
        field: payload.field ?? null,
        message: payload.message,
      });
    }

    if (opts.binary) return res.arrayBuffer();
    return parseJson(await res.text());
  }

  readonly users = {
    me: () => this.request("GET", "/api/v1/users/me"),
  };

  readonly emails = {
    send: (body: Json) => this.request("POST", "/api/v1/emails", { body }),
    sendOnCluster: (clusterId: Id, body: Json, options: ClusterSendOptions = {}) => {
      const payload = options.sandbox ? { ...body, sandbox: true } : body;
      const headers: Record<string, string> = {};
      if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
      return this.request("POST", `/clusters/${clusterId}/sends`, { body: payload, headers, team: true });
    },
  };

  readonly clusters = {
    list: () => this.request("GET", "/clusters", { team: true }),
    get: (id: Id) => this.request("GET", `/api/v1/clusters/${id}`),
    create: (body: Json) => this.request("POST", "/clusters", { body, team: true }),
    update: (id: Id, body: Json) => this.request("PATCH", `/api/v1/clusters/${id}`, { body }),
    suspend: (id: Id) => this.request("POST", `/api/v1/clusters/${id}/suspend`),
    resume: (id: Id) => this.request("POST", `/api/v1/clusters/${id}/resume`),
    delete: (id: Id) => this.request("DELETE", `/api/v1/clusters/${id}`),
  };

  readonly sendingDomains = {
    list: () => this.request("GET", "/sending_domains", { team: true }),
    get: (id: Id) => this.request("GET", `/api/v1/sending_domains/${id}`),
    create: (body: Json) => this.request("POST", "/sending_domains", { body, team: true }),
    verify: (id: Id) => this.request("POST", `/api/v1/sending_domains/${id}/verify`),
    suspend: (id: Id) => this.request("POST", `/api/v1/sending_domains/${id}/suspend`),
    resume: (id: Id) => this.request("POST", `/api/v1/sending_domains/${id}/resume`),
    makePrimary: (id: Id) => this.request("POST", `/api/v1/sending_domains/${id}/make_primary`),
    delete: (id: Id) => this.request("DELETE", `/api/v1/sending_domains/${id}`),
  };

  readonly tenants = {
    list: () => this.request("GET", "/tenants", { team: true }),
    get: (id: Id) => this.request("GET", `/api/v1/tenants/${id}`),
    create: (body: Json) => this.request("POST", "/tenants", { body, team: true }),
    delete: (id: Id) => this.request("DELETE", `/api/v1/tenants/${id}`),
  };

  readonly inboxes = {
    list: () => this.request("GET", "/inboxes", { team: true }),
    get: (id: Id) => this.request("GET", `/api/v1/inboxes/${id}`),
    create: (body: Json) => this.request("POST", "/inboxes", { body, team: true }),
    verify: (id: Id) => this.request("POST", `/api/v1/inboxes/${id}/verify`),
    delete: (id: Id) => this.request("DELETE", `/api/v1/inboxes/${id}`),
  };

  readonly messages = {
    list: (inboxId: Id) => this.request("GET", `/api/v1/inboxes/${inboxId}/inbound_messages`),
    get: (inboxId: Id, id: Id) => this.request("GET", `/api/v1/inboxes/${inboxId}/inbound_messages/${id}`),
    downloadAttachment: (inboxId: Id, id: Id, index: Id) =>
      this.request("GET", `/api/v1/inboxes/${inboxId}/inbound_messages/${id}/attachments/${index}`, { binary: true }),
  };

  readonly events = {
    list: (clusterId: Id) => this.request("GET", `/clusters/${clusterId}/message_events`, { team: true }),
    get: (id: Id) => this.request("GET", `/api/v1/message_events/${id}`),
  };

  readonly smtpCredentials = {
    create: (clusterId: Id, body: Json) =>
      this.request("POST", `/clusters/${clusterId}/smtp_credentials`, { body, team: true }),
    delete: (clusterId: Id, id: Id) =>
      this.request("DELETE", `/clusters/${clusterId}/smtp_credentials/${id}`, { team: true }),
  };

  readonly webhooks = {
    list: () => this.request("GET", "/webhook_endpoints", { team: true }),
    get: (id: Id) => this.request("GET", `/api/v1/webhook_endpoints/${id}`),
    create: (body: Json) => this.request("POST", "/webhook_endpoints", { body, team: true }),
    update: (id: Id, body: Json) => this.request("PATCH", `/api/v1/webhook_endpoints/${id}`, { body }),
    delete: (id: Id) => this.request("DELETE", `/api/v1/webhook_endpoints/${id}`),
    verify: (rawBody: string, timestamp: string, signature: string, secret: string) =>
      verifySignature(rawBody, timestamp, signature, secret),
  };

  readonly suppressions = {
    list: () => this.request("GET", "/suppressions", { team: true }),
    create: (body: Json) => this.request("POST", "/suppressions", { body, team: true }),
    delete: (id: Id) => this.request("DELETE", `/api/v1/suppressions/${id}`),
  };

  readonly firewall = {
    get: () => this.request("GET", "/firewall", { team: true }),
    update: (body: Json) => this.request("PATCH", "/firewall", { body, team: true }),
    addEntry: (body: Json) => this.request("POST", "/firewall_entries", { body, team: true }),
    deleteEntry: (id: Id) => this.request("DELETE", `/api/v1/firewall_entries/${id}`),
  };
}

function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  const given = signature.replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
