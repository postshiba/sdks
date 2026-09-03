import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostShiba, PostShibaError } from "../src/index.js";

const catalog = join(dirname(fileURLToPath(import.meta.url)), "..", "../../fixtures/catalog");

function fixture(name: string) {
  return JSON.parse(readFileSync(join(catalog, `${name}.json`), "utf8"));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("PostShiba", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function client(teamId: number | undefined = 1) {
    return new PostShiba("sk_test", { teamId });
  }

  function lastCall() {
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    return { url, init, headers: new Headers(init.headers) };
  }

  it("sends Bearer auth and honors baseUrl", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("whoami")));
    const custom = new PostShiba("sk_test", { baseUrl: "https://api.example.test/" });
    await custom.users.me();
    const { url, headers } = lastCall();
    expect(url).toBe("https://api.example.test/api/v1/users/me");
    expect(headers.get("Authorization")).toBe("Bearer sk_test");
  });

  it("sends an email", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("email_send_response")));
    const body = fixture("email_send_request");
    const result = await client().emails.send(body);
    const { url, init, headers } = lastCall();
    expect(url).toBe("https://postshiba.com/api/v1/emails");
    expect(init.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(result).toEqual(fixture("email_send_response"));
  });

  it("sends on a cluster with Idempotency-Key and sandbox", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("email_sandbox_response")));
    const body = fixture("email_send_request");
    const result = await client().emails.sendOnCluster(4, body, {
      idempotencyKey: "ikey-1",
      sandbox: true,
    });
    const { url, init, headers } = lastCall();
    expect(url).toBe("https://postshiba.com/api/v1/teams/1/clusters/4/sends");
    expect(headers.get("Idempotency-Key")).toBe("ikey-1");
    expect(JSON.parse(String(init.body))).toEqual({ ...body, sandbox: true });
    expect(result).toEqual(fixture("email_sandbox_response"));
  });

  it("covers every contract method", async () => {
    const cases: Array<{
      name: string;
      call: (c: PostShiba) => Promise<unknown>;
      method: string;
      path: string;
      request?: string;
      response: unknown;
    }> = [
      { name: "users.me", call: (c) => c.users.me(), method: "GET", path: "/api/v1/users/me", response: fixture("whoami") },
      {
        name: "emails.send",
        call: (c) => c.emails.send(fixture("email_send_request")),
        method: "POST",
        path: "/api/v1/emails",
        request: "email_send_request",
        response: fixture("email_send_response"),
      },
      {
        name: "emails.sendOnCluster",
        call: (c) => c.emails.sendOnCluster(4, fixture("email_send_request")),
        method: "POST",
        path: "/api/v1/teams/1/clusters/4/sends",
        request: "email_send_request",
        response: fixture("email_sandbox_response"),
      },
      { name: "clusters.list", call: (c) => c.clusters.list(), method: "GET", path: "/api/v1/teams/1/clusters", response: [fixture("cluster")] },
      { name: "clusters.get", call: (c) => c.clusters.get(4), method: "GET", path: "/api/v1/clusters/4", response: fixture("cluster") },
      {
        name: "clusters.create",
        call: (c) => c.clusters.create(fixture("cluster_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/clusters",
        request: "cluster_create_request",
        response: fixture("cluster"),
      },
      {
        name: "clusters.update",
        call: (c) => c.clusters.update(4, fixture("cluster_update_request")),
        method: "PATCH",
        path: "/api/v1/clusters/4",
        request: "cluster_update_request",
        response: fixture("cluster_updated"),
      },
      { name: "clusters.suspend", call: (c) => c.clusters.suspend(4), method: "POST", path: "/api/v1/clusters/4/suspend", response: fixture("cluster_suspended") },
      { name: "clusters.resume", call: (c) => c.clusters.resume(4), method: "POST", path: "/api/v1/clusters/4/resume", response: fixture("cluster") },
      { name: "clusters.delete", call: (c) => c.clusters.delete(4), method: "DELETE", path: "/api/v1/clusters/4", response: fixture("cluster_deprovisioned") },
      { name: "sendingDomains.list", call: (c) => c.sendingDomains.list(), method: "GET", path: "/api/v1/teams/1/sending_domains", response: [fixture("sending_domain")] },
      { name: "sendingDomains.get", call: (c) => c.sendingDomains.get(8), method: "GET", path: "/api/v1/sending_domains/8", response: fixture("sending_domain") },
      {
        name: "sendingDomains.create",
        call: (c) => c.sendingDomains.create(fixture("sending_domain_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/sending_domains",
        request: "sending_domain_create_request",
        response: fixture("sending_domain"),
      },
      { name: "sendingDomains.verify", call: (c) => c.sendingDomains.verify(8), method: "POST", path: "/api/v1/sending_domains/8/verify", response: fixture("sending_domain") },
      { name: "sendingDomains.suspend", call: (c) => c.sendingDomains.suspend(8), method: "POST", path: "/api/v1/sending_domains/8/suspend", response: fixture("sending_domain_suspended") },
      { name: "sendingDomains.resume", call: (c) => c.sendingDomains.resume(8), method: "POST", path: "/api/v1/sending_domains/8/resume", response: fixture("sending_domain") },
      { name: "sendingDomains.makePrimary", call: (c) => c.sendingDomains.makePrimary(8), method: "POST", path: "/api/v1/sending_domains/8/make_primary", response: fixture("sending_domain_primary") },
      { name: "sendingDomains.delete", call: (c) => c.sendingDomains.delete(8), method: "DELETE", path: "/api/v1/sending_domains/8", response: fixture("empty") },
      { name: "tenants.list", call: (c) => c.tenants.list(), method: "GET", path: "/api/v1/teams/1/tenants", response: [fixture("tenant")] },
      { name: "tenants.get", call: (c) => c.tenants.get(12), method: "GET", path: "/api/v1/tenants/12", response: fixture("tenant") },
      {
        name: "tenants.create",
        call: (c) => c.tenants.create(fixture("tenant_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/tenants",
        request: "tenant_create_request",
        response: fixture("tenant"),
      },
      { name: "tenants.delete", call: (c) => c.tenants.delete(12), method: "DELETE", path: "/api/v1/tenants/12", response: fixture("empty") },
      { name: "inboxes.list", call: (c) => c.inboxes.list(), method: "GET", path: "/api/v1/teams/1/inboxes", response: [fixture("inbox_index")] },
      { name: "inboxes.get", call: (c) => c.inboxes.get(3), method: "GET", path: "/api/v1/inboxes/3", response: fixture("inbox") },
      {
        name: "inboxes.create",
        call: (c) => c.inboxes.create(fixture("inbox_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/inboxes",
        request: "inbox_create_request",
        response: fixture("inbox"),
      },
      { name: "inboxes.verify", call: (c) => c.inboxes.verify(3), method: "POST", path: "/api/v1/inboxes/3/verify", response: fixture("inbox_index") },
      { name: "inboxes.delete", call: (c) => c.inboxes.delete(3), method: "DELETE", path: "/api/v1/inboxes/3", response: fixture("inbox_index") },
      { name: "messages.list", call: (c) => c.messages.list(3), method: "GET", path: "/api/v1/inboxes/3/inbound_messages", response: [fixture("message")] },
      { name: "messages.get", call: (c) => c.messages.get(3, 21), method: "GET", path: "/api/v1/inboxes/3/inbound_messages/21", response: fixture("message_show") },
      { name: "events.list", call: (c) => c.events.list(4), method: "GET", path: "/api/v1/teams/1/clusters/4/message_events", response: [fixture("event")] },
      { name: "events.get", call: (c) => c.events.get(44), method: "GET", path: "/api/v1/message_events/44", response: fixture("event") },
      {
        name: "smtpCredentials.create",
        call: (c) => c.smtpCredentials.create(4, fixture("smtp_credential_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/clusters/4/smtp_credentials",
        request: "smtp_credential_create_request",
        response: fixture("smtp_credential_create"),
      },
      {
        name: "smtpCredentials.delete",
        call: (c) => c.smtpCredentials.delete(4, 9),
        method: "DELETE",
        path: "/api/v1/teams/1/clusters/4/smtp_credentials/9",
        response: fixture("smtp_credential_deleted"),
      },
      { name: "webhooks.list", call: (c) => c.webhooks.list(), method: "GET", path: "/api/v1/teams/1/webhook_endpoints", response: [fixture("webhook")] },
      { name: "webhooks.get", call: (c) => c.webhooks.get(2), method: "GET", path: "/api/v1/webhook_endpoints/2", response: fixture("webhook_show") },
      {
        name: "webhooks.create",
        call: (c) => c.webhooks.create(fixture("webhook_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/webhook_endpoints",
        request: "webhook_create_request",
        response: fixture("webhook_show"),
      },
      { name: "suppressions.list", call: (c) => c.suppressions.list(), method: "GET", path: "/api/v1/teams/1/suppressions", response: [fixture("suppression")] },
      {
        name: "suppressions.create",
        call: (c) => c.suppressions.create(fixture("suppression_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/suppressions",
        request: "suppression_create_request",
        response: fixture("suppression"),
      },
      { name: "suppressions.delete", call: (c) => c.suppressions.delete(7), method: "DELETE", path: "/api/v1/suppressions/7", response: fixture("empty") },
      { name: "firewall.get", call: (c) => c.firewall.get(), method: "GET", path: "/api/v1/teams/1/firewall", response: fixture("firewall") },
      {
        name: "firewall.update",
        call: (c) => c.firewall.update(fixture("firewall_update_request")),
        method: "PATCH",
        path: "/api/v1/teams/1/firewall",
        request: "firewall_update_request",
        response: fixture("firewall"),
      },
      {
        name: "firewall.addEntry",
        call: (c) => c.firewall.addEntry(fixture("firewall_entry_create_request")),
        method: "POST",
        path: "/api/v1/teams/1/firewall_entries",
        request: "firewall_entry_create_request",
        response: fixture("firewall_entry"),
      },
      { name: "firewall.deleteEntry", call: (c) => c.firewall.deleteEntry(3), method: "DELETE", path: "/api/v1/firewall_entries/3", response: fixture("empty") },
    ];

    for (const row of cases) {
      fetchMock.mockResolvedValueOnce(jsonResponse(row.response));
      const result = await row.call(client());
      const { url, init } = lastCall();
      expect(url, row.name).toBe(`https://postshiba.com${row.path}`);
      expect(init.method, row.name).toBe(row.method);
      if (row.request) expect(JSON.parse(String(init.body)), row.name).toEqual(fixture(row.request));
      expect(result, row.name).toEqual(row.response);
    }

    fetchMock.mockResolvedValueOnce(new Response(Buffer.from("png"), { status: 200 }));
    const bytes = await client().messages.downloadAttachment(3, 21, 1);
    const { url, init } = lastCall();
    expect(url).toBe("https://postshiba.com/api/v1/inboxes/3/inbound_messages/21/attachments/1");
    expect(init.method).toBe("GET");
    expect(bytes).toBeInstanceOf(ArrayBuffer);
  });

  it("raises 403 and 422 from fixtures", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("error_403"), 403));
    const forbidden = await client().clusters.create(fixture("cluster_create_request")).catch((err) => err);
    expect(forbidden).toBeInstanceOf(PostShibaError);
    expect(forbidden.error).toBe(fixture("error_403").error);
    expect(forbidden.field).toBe(fixture("error_403").field);
    expect(forbidden.message).toBe(fixture("error_403").message);

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("error_422"), 422));
    const invalid = await client().emails.send(fixture("email_send_request")).catch((err) => err);
    expect(invalid).toBeInstanceOf(PostShibaError);
    expect(invalid.error).toBe(fixture("error_422").error);
    expect(invalid.field).toBe(fixture("error_422").field);
    expect(invalid.message).toBe(fixture("error_422").message);
  });

  it("verifies webhook signatures", () => {
    const sample = fixture("webhook_verify");
    const ok = client().webhooks.verify(sample.body, sample.timestamp, sample.signature, sample.secret);
    expect(ok).toBe(true);
    const bad = client().webhooks.verify(sample.body, sample.timestamp, "sha256=00", sample.secret);
    expect(bad).toBe(false);
  });

  it("returns SMTP password on create and omits it on delete", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("smtp_credential_create")));
    const created = (await client().smtpCredentials.create(4, fixture("smtp_credential_create_request"))) as Record<string, unknown>;
    expect(created.password).toBe("once-only-password");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("smtp_credential_deleted")));
    const deleted = (await client().smtpCredentials.delete(4, 9)) as Record<string, unknown>;
    expect(deleted).not.toHaveProperty("password");
  });

  it("omits webhook secret on list and returns it on get and create", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([fixture("webhook")]));
    const listed = (await client().webhooks.list()) as Array<Record<string, unknown>>;
    expect(listed[0]).not.toHaveProperty("secret");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("webhook_show")));
    const shown = (await client().webhooks.get(2)) as Record<string, unknown>;
    expect(shown.secret).toBe("hex-secret");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("webhook_show")));
    const created = (await client().webhooks.create(fixture("webhook_create_request"))) as Record<string, unknown>;
    expect(created.secret).toBe("hex-secret");
  });

  it("raises when teamId is missing on a team-scoped call", async () => {
    await expect(new PostShiba("sk_test").clusters.list()).rejects.toThrow(/teamId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
