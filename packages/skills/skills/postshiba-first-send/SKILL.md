---
name: postshiba-first-send
description: Coordinates a first PostShiba send across cluster selection, domain DNS, credentials, SDK setup, verification, and a sandbox test. Applies when a user asks to configure an application for its first PostShiba send.
---

# Complete a first send

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Call `whoami` to confirm access. Never use the returned email as `From`.
2. Call `list_clusters`. Reuse a suitable existing cluster.
   - If no cluster exists, call `create_cluster` for a shared-IP cluster named after the team.
   - If creation returns `kyc_required`, stop. The team needs approval for another cluster, and KYC is not an MCP action.
   - If creation returns `payment_required`, stop.
3. Call `list_sending_domains`. Reuse the requested domain if it exists.
   - If it does not exist, ask for a fully qualified sending hostname and call `create_sending_domain`.
   - Keep the returned domain id and DNS values.
   - If DKIM and return-path already report verified, skip the DNS publishing and verification steps.
4. Call `create_smtp_credential` on the selected cluster. The default credential from cluster creation hides its password, so do not try to recover it.
   - Return the new username and one-time password once.
   - Do not write the password to source control or claim that MCP can reveal it later.
5. Inspect the user's repository before changing it.
   - Identify the server-side application from its manifests, lockfiles, framework files, and current mail configuration. Do not infer the target from file extensions alone.
   - Prefer a specific integration over its base language. Prefer Convex over generic Node.js and WordPress over generic PHP. Use the documented NestJS, Django, Laravel, Symfony, ActionMailer, or Swoosh adapter when the application already uses that framework.
   - If several applications could own outbound mail, ask which one to configure.
   - Read the selected integration's current README in the `postshiba` GitHub organization. Follow its documented installation source, package manager, adapter, option names, and test command. Never assume one language, hardcode one SDK, or invent a registry package.
   - Keep the platform application token in the existing server-side secret store. It is a team-admin token. Never expose it to browser or mobile code, copy the MCP credential into source files, or use the SMTP password with an HTTP SDK.
   - If the repository has no trusted server boundary, stop and explain what server-side component is required.
   - Preserve the application's existing mail abstraction. Configure only the team or cluster values required by the selected SDK and send path, then run the repository's existing checks.
6. For a domain that is not already verified, show the exact DNS records from the tool response.
   - For default DKIM, show the DKIM CNAME host and target.
   - For manual DKIM, show `dkim_txt` as a TXT record at the selector, not as a CNAME.
   - Show the return-path CNAME host and target.
   - State that MCP cannot publish DNS.
   - Stop and ask the user to publish the required records.
   - Do not call `verify_sending_domain` until the user explicitly confirms that the records are published.
7. After confirmation, call `verify_sending_domain`. Continue only when DKIM and return-path report verified. If either is pending or failed, report the returned status and verification error, then stop.
8. Call `get_cluster` until `sending_ready` is true. Do not send before then.
9. Choose a user-approved test recipient. Until the team is approved, use only a team member address or a live inbox address.
10. Call `send_on_cluster` with the selected cluster id and `sandbox: true`.
    - Omit `from`, or use an address on the verified sending domain.
    - Never call `send_email` for a sandbox test.
    - MCP cannot set `Idempotency-Key` or `X-Capsule-Cluster-Id`, send through SMTP, or recover a redacted secret.
11. Confirm that the sandbox result has `queued: false`. Report the configured application files, selected ids, DNS status, and test result without exposing secrets.
