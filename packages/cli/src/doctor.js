// @ts-check

import { request } from "./client.js";
import { domainVerified } from "./render.js";

/**
 * @param {object} creds
 * @param {string} [creds.apiKey]
 * @param {string} [creds.teamId]
 * @param {string} creds.baseUrl
 * @param {typeof fetch} fetchImpl
 */
export async function runDoctor(creds, fetchImpl) {
  /** @type {{ id: string, ok: boolean, detail?: string, fix?: string }[]} */
  const checks = [];

  if (!creds.apiKey) {
    checks.push({ id: "key", ok: false, fix: "postshiba login" });
  } else {
    try {
      const me = /** @type {{ email?: string }} */ (
        await request({
          method: "GET",
          url: `${creds.baseUrl}/api/v1/users/me`,
          apiKey: creds.apiKey,
          fetch: fetchImpl,
        })
      );
      checks.push({ id: "key", ok: true, detail: me.email });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({ id: "key", ok: false, detail: message, fix: "postshiba login" });
    }
  }

  if (!creds.teamId) {
    checks.push({ id: "team", ok: false, fix: "pass --team or run postshiba login" });
  } else {
    checks.push({ id: "team", ok: true, detail: creds.teamId });
  }

  if (creds.apiKey && creds.teamId) {
    try {
      const clusters = asList(
        await request({
          method: "GET",
          url: `${creds.baseUrl}/api/v1/teams/${creds.teamId}/clusters`,
          apiKey: creds.apiKey,
          fetch: fetchImpl,
        }),
      );
      const ready = clusters.find((item) => item.sending_ready);
      if (ready) checks.push({ id: "cluster", ok: true, detail: String(ready.name ?? ready.id) });
      else {
        checks.push({
          id: "cluster",
          ok: false,
          fix: `postshiba clusters create --data '{"name":"edge"}'`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({ id: "cluster", ok: false, detail: message, fix: "postshiba clusters list" });
    }

    try {
      const domains = asList(
        await request({
          method: "GET",
          url: `${creds.baseUrl}/api/v1/teams/${creds.teamId}/sending_domains`,
          apiKey: creds.apiKey,
          fetch: fetchImpl,
        }),
      );
      const verified = domains.find(domainVerified);
      if (verified) checks.push({ id: "sending_domain", ok: true, detail: String(verified.name) });
      else {
        checks.push({
          id: "sending_domain",
          ok: false,
          fix: "postshiba sending-domains create",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: "sending_domain",
        ok: false,
        detail: message,
        fix: "postshiba sending-domains create",
      });
    }
  } else {
    if (!checks.some((item) => item.id === "cluster")) {
      checks.push({ id: "cluster", ok: false, fix: "postshiba clusters create --data '{\"name\":\"edge\"}'" });
    }
    if (!checks.some((item) => item.id === "sending_domain")) {
      checks.push({ id: "sending_domain", ok: false, fix: "postshiba sending-domains create" });
    }
  }

  return { ok: checks.every((item) => item.ok), checks };
}

/**
 * @param {unknown} value
 * @returns {Record<string, any>[]}
 */
function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

/**
 * @param {{ id: string, ok: boolean, detail?: string, fix?: string }} check
 */
export function doctorLabel(check) {
  const labels = {
    key: "API key",
    team: "Team id",
    cluster: "Sending-ready cluster",
    sending_domain: "Verified sending domain",
  };
  return labels[/** @type {keyof typeof labels} */ (check.id)] ?? check.id;
}
