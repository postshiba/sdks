import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fixture, jsonResponse, lastCall, mockFetch, runCli } from "../support.js";

const KEY = "sk_never_print_this_key";
const env = { POSTSHIBA_API_KEY: KEY, POSTSHIBA_TEAM_ID: "KjkAJW" };

function sendFlags(body, attachPath) {
  return [
    "send",
    "--from",
    body.from,
    "--to",
    body.to[0],
    "--reply-to",
    body.reply_to,
    "--subject",
    body.subject,
    "--text",
    body.text,
    "--html",
    body.html,
    "--attach",
    attachPath,
    "--header",
    "X-Campaign: cmp_123",
    "--arg",
    "campaign_id=cmp_123",
    "--arg",
    "site=docs",
    "--tenant",
    body.tenant,
  ];
}

describe("send", () => {
  it("builds the email_send_request body from flags and a temp attachment", async () => {
    const body = fixture("email_send_request");
    const dir = await mkdtemp(join(tmpdir(), "postshiba-cli-"));
    const attachPath = join(dir, "photo.png");
    await writeFile(attachPath, Buffer.from(body.attachments[0].content, "base64"));
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_send_response")));
    const result = await runCli(sendFlags(body, attachPath), { env, fetch: fetchImpl });
    assert.equal(result.code, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
    const call = lastCall(fetchImpl);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/emails");
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("Authorization"), `Bearer ${KEY}`);
    assert.equal(call.headers.get("Content-Type"), "application/json");
    assert.equal(call.headers.get("X-Capsule-Cluster-Id"), null);
    assert.deepEqual(JSON.parse(call.body), body);
    assert.deepEqual(JSON.parse(result.stdout), fixture("email_send_response"));
  });

  it("builds the email_send_template_request body from --template and --var", async () => {
    const body = fixture("email_send_template_request");
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_send_template_response")));
    const result = await runCli(
      [
        "send",
        "--from",
        body.from,
        "--to",
        body.to[0],
        "--template",
        body.template.id,
        "--var",
        "name=Ada",
        "--var",
        "body=Your account is ready.",
        "--arg",
        "campaign_id=cmp_123",
        "--arg",
        "site=docs",
      ],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 0);
    const call = lastCall(fetchImpl);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/emails");
    assert.equal(call.method, "POST");
    assert.deepEqual(JSON.parse(call.body), body);
    assert.deepEqual(JSON.parse(result.stdout), fixture("email_send_template_response"));
  });

  it("sets X-Capsule-Cluster-Id on POST /api/v1/emails", async () => {
    const body = fixture("email_send_request");
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_send_response")));
    const result = await runCli(
      ["send", "--cluster", "NmQpXr", "--data", JSON.stringify(body)],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 0);
    const call = lastCall(fetchImpl);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/emails");
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("X-Capsule-Cluster-Id"), "NmQpXr");
    assert.equal(call.headers.get("Idempotency-Key"), null);
    assert.deepEqual(JSON.parse(call.body), body);
  });

  it("routes --sandbox to the team cluster sends path", async () => {
    const body = fixture("email_send_request");
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_sandbox_response")));
    const result = await runCli(
      ["send", "--sandbox", "--cluster", "NmQpXr", "--data", JSON.stringify(body)],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 0);
    const call = lastCall(fetchImpl);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/teams/KjkAJW/clusters/NmQpXr/sends");
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("Authorization"), `Bearer ${KEY}`);
    assert.deepEqual(JSON.parse(call.body), { ...body, sandbox: true });
    assert.deepEqual(JSON.parse(result.stdout), fixture("email_sandbox_response"));
  });

  it("sets Idempotency-Key on the cluster send path", async () => {
    const body = fixture("email_send_request");
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_sandbox_response")));
    const result = await runCli(
      ["send", "--idempotency-key", "ikey-1", "--cluster", "NmQpXr", "--data", JSON.stringify(body)],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 0);
    const call = lastCall(fetchImpl);
    assert.equal(call.url, "https://app.postshiba.com/api/v1/teams/KjkAJW/clusters/NmQpXr/sends");
    assert.equal(call.method, "POST");
    assert.equal(call.headers.get("Idempotency-Key"), "ikey-1");
    assert.deepEqual(JSON.parse(call.body), body);
  });

  it("exits 2 when --sandbox is used without --cluster", async () => {
    const fetchImpl = mockFetch(() => jsonResponse(fixture("email_send_response")));
    const result = await runCli(
      ["send", "--sandbox", "--from", "a@b.com", "--to", "c@d.com", "--subject", "x", "--text", "y"],
      { env, fetch: fetchImpl },
    );
    assert.equal(result.code, 2);
    assert.match(result.stderr, /--cluster/);
    assert.match(result.stderr, /postshiba help send/);
    assert.equal(fetchImpl.calls.length, 0);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_never_print_this_key/);
  });
});
