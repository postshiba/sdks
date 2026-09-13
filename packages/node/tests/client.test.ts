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

  function client(teamId: string | undefined = "KjkAJW") {
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
    expect(url).toBe("https://app.postshiba.com/api/v1/emails");
    expect(init.method).toBe("POST");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(headers.get("X-Capsule-Cluster-Id")).toBeNull();
    expect(result).toEqual(fixture("email_send_response"));
  });

  it("sends a published template", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("email_send_template_response")));
    const body = fixture("email_send_template_request");
    const result = await client().emails.send(body);
    const { url, init, headers } = lastCall();
    expect(url).toBe("https://app.postshiba.com/api/v1/emails");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(headers.get("X-Capsule-Cluster-Id")).toBeNull();
    expect(result).toEqual(fixture("email_send_template_response"));
  });

  it("sends an email with X-Capsule-Cluster-Id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("email_send_response")));
    const body = fixture("email_send_request");
    const result = await client().emails.send(body, { clusterId: "NmQpXr" });
    const { url, init, headers } = lastCall();
    expect(url).toBe("https://app.postshiba.com/api/v1/emails");
    expect(init.method).toBe("POST");
    expect(headers.get("X-Capsule-Cluster-Id")).toBe("NmQpXr");
    expect(JSON.parse(String(init.body))).toEqual(body);
    expect(result).toEqual(fixture("email_send_response"));
  });

  it("sends on a cluster with Idempotency-Key and sandbox", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("email_sandbox_response")));
    const body = fixture("email_send_request");
    const result = await client().emails.sendOnCluster("NmQpXr", body, {
      idempotencyKey: "ikey-1",
      sandbox: true,
    });
    const { url, init, headers } = lastCall();
    expect(url).toBe("https://app.postshiba.com/api/v1/teams/KjkAJW/clusters/NmQpXr/sends");
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
        call: (c) => c.emails.sendOnCluster("NmQpXr", fixture("email_send_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/clusters/NmQpXr/sends",
        request: "email_send_request",
        response: fixture("email_sandbox_response"),
      },
      { name: "clusters.list", call: (c) => c.clusters.list(), method: "GET", path: "/api/v1/teams/KjkAJW/clusters", response: [fixture("cluster")] },
      { name: "clusters.get", call: (c) => c.clusters.get("NmQpXr"), method: "GET", path: "/api/v1/clusters/NmQpXr", response: fixture("cluster") },
      {
        name: "clusters.create",
        call: (c) => c.clusters.create(fixture("cluster_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/clusters",
        request: "cluster_create_request",
        response: fixture("cluster"),
      },
      {
        name: "clusters.update",
        call: (c) => c.clusters.update("NmQpXr", fixture("cluster_update_request")),
        method: "PATCH",
        path: "/api/v1/clusters/NmQpXr",
        request: "cluster_update_request",
        response: fixture("cluster_updated"),
      },
      { name: "clusters.suspend", call: (c) => c.clusters.suspend("NmQpXr"), method: "POST", path: "/api/v1/clusters/NmQpXr/suspend", response: fixture("cluster_suspended") },
      { name: "clusters.resume", call: (c) => c.clusters.resume("NmQpXr"), method: "POST", path: "/api/v1/clusters/NmQpXr/resume", response: fixture("cluster") },
      { name: "clusters.delete", call: (c) => c.clusters.delete("NmQpXr"), method: "DELETE", path: "/api/v1/clusters/NmQpXr", response: fixture("cluster_deprovisioned") },
      {
        name: "clusters.boost",
        call: (c) => c.clusters.boost("NmQpXr", fixture("cluster_boost_request")),
        method: "POST",
        path: "/api/v1/clusters/NmQpXr/boost",
        request: "cluster_boost_request",
        response: fixture("cluster_boosted"),
      },
      {
        name: "clusters.extendBoost",
        call: (c) => c.clusters.extendBoost("NmQpXr", fixture("cluster_extend_boost_request")),
        method: "POST",
        path: "/api/v1/clusters/NmQpXr/extend_boost",
        request: "cluster_extend_boost_request",
        response: fixture("cluster_boosted"),
      },
      { name: "clusters.cancelBoost", call: (c) => c.clusters.cancelBoost("NmQpXr"), method: "POST", path: "/api/v1/clusters/NmQpXr/cancel_boost", response: fixture("cluster") },
      { name: "network.list", call: (c) => c.network.list(), method: "GET", path: "/api/v1/teams/KjkAJW/network", response: [fixture("network")] },
      {
        name: "network.create",
        call: (c) => c.network.create(fixture("network_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/network",
        request: "network_create_request",
        response: fixture("network_assigned"),
      },
      {
        name: "network.assign",
        call: (c) => c.network.assign(fixture("network_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/network/assign",
        request: "network_create_request",
        response: fixture("network_dedicated"),
      },
      {
        name: "network.unassign",
        call: (c) => c.network.unassign(fixture("network_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/network/unassign",
        request: "network_create_request",
        response: fixture("network"),
      },
      {
        name: "network.switch",
        call: (c) => c.network.switch(fixture("network_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/network/switch",
        request: "network_create_request",
        response: fixture("network_assigned"),
      },
      {
        name: "network.release",
        call: (c) => c.network.release(fixture("network_release_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/network/release",
        request: "network_release_request",
        response: fixture("network_released"),
      },
      { name: "sendingDomains.list", call: (c) => c.sendingDomains.list(), method: "GET", path: "/api/v1/teams/KjkAJW/sending_domains", response: [fixture("sending_domain")] },
      { name: "sendingDomains.get", call: (c) => c.sendingDomains.get("HsVtYk"), method: "GET", path: "/api/v1/sending_domains/HsVtYk", response: fixture("sending_domain") },
      {
        name: "sendingDomains.create",
        call: (c) => c.sendingDomains.create(fixture("sending_domain_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/sending_domains",
        request: "sending_domain_create_request",
        response: fixture("sending_domain"),
      },
      {
        name: "sendingDomains.update",
        call: (c) => c.sendingDomains.update("HsVtYk", fixture("sending_domain_update_request")),
        method: "PATCH",
        path: "/api/v1/sending_domains/HsVtYk",
        request: "sending_domain_update_request",
        response: fixture("sending_domain_updated"),
      },
      { name: "sendingDomains.refresh", call: (c) => c.sendingDomains.refresh("HsVtYk"), method: "POST", path: "/api/v1/sending_domains/HsVtYk/refresh", response: fixture("sending_domain") },
      { name: "sendingDomains.verify", call: (c) => c.sendingDomains.verify("HsVtYk"), method: "POST", path: "/api/v1/sending_domains/HsVtYk/verify", response: fixture("sending_domain") },
      { name: "sendingDomains.suspend", call: (c) => c.sendingDomains.suspend("HsVtYk"), method: "POST", path: "/api/v1/sending_domains/HsVtYk/suspend", response: fixture("sending_domain_suspended") },
      { name: "sendingDomains.resume", call: (c) => c.sendingDomains.resume("HsVtYk"), method: "POST", path: "/api/v1/sending_domains/HsVtYk/resume", response: fixture("sending_domain") },
      { name: "sendingDomains.makePrimary", call: (c) => c.sendingDomains.makePrimary("HsVtYk"), method: "POST", path: "/api/v1/sending_domains/HsVtYk/make_primary", response: fixture("sending_domain_primary") },
      { name: "sendingDomains.delete", call: (c) => c.sendingDomains.delete("HsVtYk"), method: "DELETE", path: "/api/v1/sending_domains/HsVtYk", response: fixture("empty") },
      { name: "tenants.list", call: (c) => c.tenants.list(), method: "GET", path: "/api/v1/teams/KjkAJW/tenants", response: [fixture("tenant")] },
      { name: "tenants.get", call: (c) => c.tenants.get("WbLcFd"), method: "GET", path: "/api/v1/tenants/WbLcFd", response: fixture("tenant") },
      {
        name: "tenants.create",
        call: (c) => c.tenants.create(fixture("tenant_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/tenants",
        request: "tenant_create_request",
        response: fixture("tenant"),
      },
      { name: "tenants.delete", call: (c) => c.tenants.delete("WbLcFd"), method: "DELETE", path: "/api/v1/tenants/WbLcFd", response: fixture("empty") },
      { name: "inboxes.list", call: (c) => c.inboxes.list(), method: "GET", path: "/api/v1/teams/KjkAJW/inboxes", response: [fixture("inbox_index")] },
      { name: "inboxes.get", call: (c) => c.inboxes.get("PqRzMn"), method: "GET", path: "/api/v1/inboxes/PqRzMn", response: fixture("inbox") },
      {
        name: "inboxes.create",
        call: (c) => c.inboxes.create(fixture("inbox_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/inboxes",
        request: "inbox_create_request",
        response: fixture("inbox"),
      },
      { name: "inboxes.verify", call: (c) => c.inboxes.verify("PqRzMn"), method: "POST", path: "/api/v1/inboxes/PqRzMn/verify", response: fixture("inbox_index") },
      { name: "inboxes.delete", call: (c) => c.inboxes.delete("PqRzMn"), method: "DELETE", path: "/api/v1/inboxes/PqRzMn", response: fixture("inbox_index") },
      { name: "messages.list", call: (c) => c.messages.list("PqRzMn"), method: "GET", path: "/api/v1/inboxes/PqRzMn/inbound_messages", response: [fixture("message")] },
      { name: "messages.get", call: (c) => c.messages.get("PqRzMn", "GxTyVu"), method: "GET", path: "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu", response: fixture("message_show") },
      { name: "events.listTeam", call: (c) => c.events.listTeam(), method: "GET", path: "/api/v1/teams/KjkAJW/message_events", response: [fixture("event")] },
      { name: "events.list", call: (c) => c.events.list("NmQpXr"), method: "GET", path: "/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events", response: [fixture("event")] },
      { name: "events.get", call: (c) => c.events.get("JkLmNp"), method: "GET", path: "/api/v1/message_events/JkLmNp", response: fixture("event") },
      {
        name: "smtpCredentials.create",
        call: (c) => c.smtpCredentials.create("NmQpXr", fixture("smtp_credential_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials",
        request: "smtp_credential_create_request",
        response: fixture("smtp_credential_create"),
      },
      {
        name: "smtpCredentials.delete",
        call: (c) => c.smtpCredentials.delete("NmQpXr", "RvWsXq"),
        method: "DELETE",
        path: "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq",
        response: fixture("smtp_credential_deleted"),
      },
      { name: "webhooks.list", call: (c) => c.webhooks.list(), method: "GET", path: "/api/v1/teams/KjkAJW/webhook_endpoints", response: [fixture("webhook")] },
      { name: "webhooks.get", call: (c) => c.webhooks.get("CdFgHj"), method: "GET", path: "/api/v1/webhook_endpoints/CdFgHj", response: fixture("webhook_show") },
      {
        name: "webhooks.create",
        call: (c) => c.webhooks.create(fixture("webhook_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/webhook_endpoints",
        request: "webhook_create_request",
        response: fixture("webhook_show"),
      },
      {
        name: "webhooks.update",
        call: (c) => c.webhooks.update("CdFgHj", fixture("webhook_update_request")),
        method: "PATCH",
        path: "/api/v1/webhook_endpoints/CdFgHj",
        request: "webhook_update_request",
        response: fixture("webhook"),
      },
      { name: "webhooks.delete", call: (c) => c.webhooks.delete("CdFgHj"), method: "DELETE", path: "/api/v1/webhook_endpoints/CdFgHj", response: fixture("empty") },
      { name: "templates.list", call: (c) => c.templates.list(), method: "GET", path: "/api/v1/teams/KjkAJW/templates", response: [fixture("template")] },
      { name: "templates.get", call: (c) => c.templates.get("TpLmQr"), method: "GET", path: "/api/v1/templates/TpLmQr", response: fixture("template") },
      {
        name: "templates.create",
        call: (c) => c.templates.create(fixture("template_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/templates",
        request: "template_create_request",
        response: fixture("template"),
      },
      {
        name: "templates.update",
        call: (c) => c.templates.update("TpLmQr", fixture("template_update_request")),
        method: "PATCH",
        path: "/api/v1/templates/TpLmQr",
        request: "template_update_request",
        response: fixture("template_updated"),
      },
      { name: "templates.publish", call: (c) => c.templates.publish("TpLmQr"), method: "POST", path: "/api/v1/templates/TpLmQr/publish", response: fixture("template") },
      { name: "templates.duplicate", call: (c) => c.templates.duplicate("TpLmQr"), method: "POST", path: "/api/v1/templates/TpLmQr/duplicate", response: fixture("template_duplicated") },
      { name: "templates.delete", call: (c) => c.templates.delete("TpLmQr"), method: "DELETE", path: "/api/v1/templates/TpLmQr", response: fixture("empty") },
      { name: "suppressions.list", call: (c) => c.suppressions.list(), method: "GET", path: "/api/v1/teams/KjkAJW/suppressions", response: [fixture("suppression")] },
      {
        name: "suppressions.create",
        call: (c) => c.suppressions.create(fixture("suppression_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/suppressions",
        request: "suppression_create_request",
        response: fixture("suppression"),
      },
      {
        name: "suppressions.import",
        call: (c) => c.suppressions.import(fixture("suppression_import_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/suppressions/import",
        request: "suppression_import_request",
        response: fixture("suppression_import"),
      },
      { name: "suppressions.delete", call: (c) => c.suppressions.delete("YtReWq"), method: "DELETE", path: "/api/v1/suppressions/YtReWq", response: fixture("empty") },
      { name: "firewall.get", call: (c) => c.firewall.get(), method: "GET", path: "/api/v1/teams/KjkAJW/firewall", response: fixture("firewall") },
      {
        name: "firewall.update",
        call: (c) => c.firewall.update(fixture("firewall_update_request")),
        method: "PATCH",
        path: "/api/v1/teams/KjkAJW/firewall",
        request: "firewall_update_request",
        response: fixture("firewall"),
      },
      {
        name: "firewall.addEntry",
        call: (c) => c.firewall.addEntry(fixture("firewall_entry_create_request")),
        method: "POST",
        path: "/api/v1/teams/KjkAJW/firewall_entries",
        request: "firewall_entry_create_request",
        response: fixture("firewall_entry"),
      },
      { name: "firewall.deleteEntry", call: (c) => c.firewall.deleteEntry("BnMkLo"), method: "DELETE", path: "/api/v1/firewall_entries/BnMkLo", response: fixture("empty") },
    ];

    for (const row of cases) {
      fetchMock.mockResolvedValueOnce(jsonResponse(row.response));
      const result = await row.call(client());
      const { url, init } = lastCall();
      expect(url, row.name).toBe(`https://app.postshiba.com${row.path}`);
      expect(init.method, row.name).toBe(row.method);
      if (row.request) expect(JSON.parse(String(init.body)), row.name).toEqual(fixture(row.request));
      expect(result, row.name).toEqual(row.response);
    }

    fetchMock.mockResolvedValueOnce(new Response(Buffer.from("png"), { status: 200 }));
    const bytes = await client().messages.downloadAttachment("PqRzMn", "GxTyVu", 1);
    const { url, init } = lastCall();
    expect(url).toBe("https://app.postshiba.com/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1");
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
    const created = (await client().smtpCredentials.create("NmQpXr", fixture("smtp_credential_create_request"))) as Record<string, unknown>;
    expect(created.password).toBe("once-only-password");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("smtp_credential_deleted")));
    const deleted = (await client().smtpCredentials.delete("NmQpXr", "RvWsXq")) as Record<string, unknown>;
    expect(deleted).not.toHaveProperty("password");
  });

  it("omits webhook secret on list and update and returns it on get and create", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([fixture("webhook")]));
    const listed = (await client().webhooks.list()) as Array<Record<string, unknown>>;
    expect(listed[0]).not.toHaveProperty("secret");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("webhook_show")));
    const shown = (await client().webhooks.get("CdFgHj")) as Record<string, unknown>;
    expect(shown.secret).toBe("hex-secret");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("webhook_show")));
    const created = (await client().webhooks.create(fixture("webhook_create_request"))) as Record<string, unknown>;
    expect(created.secret).toBe("hex-secret");

    fetchMock.mockResolvedValueOnce(jsonResponse(fixture("webhook")));
    const updated = (await client().webhooks.update("CdFgHj", fixture("webhook_update_request"))) as Record<string, unknown>;
    expect(updated).toEqual(fixture("webhook"));
    expect(updated).not.toHaveProperty("secret");
  });

  it("raises when teamId is missing on a team-scoped call", async () => {
    await expect(new PostShiba("sk_test").clusters.list()).rejects.toThrow(/teamId/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
