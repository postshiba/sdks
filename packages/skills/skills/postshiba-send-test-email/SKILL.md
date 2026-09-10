---
name: postshiba-send-test-email
description: Runs a non-delivering sandbox email through a PostShiba cluster and checks every send gate. Applies when a user asks to test PostShiba email configuration without delivering a live message.
---

# Send a sandbox test

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Use the requested cluster id. If none was supplied, call `list_clusters` and select the intended cluster.
2. Call `get_cluster`. If the cluster is still provisioning, poll until `sending_ready` is true.
3. Call `list_sending_domains` and confirm that the intended `From` domain has verified DKIM and return-path records.
   - Omit `from` to use the first sending-ready domain, or use an address on a verified sending domain.
   - Never use the `whoami` email as `From`.
   - A hosted inbox is inbound-only and cannot be used as `From`.
   - If no domain is verified, stop and use the `postshiba-send-from-domain` workflow.
4. Choose a user-approved recipient. Until the team is approved, use only a team member email or a live inbox address. Any other recipient returns `403 kyc_required`.
5. Call `send_on_cluster` with the selected cluster id, message content, and `sandbox: true`.
   - Sandbox mode runs the same cluster, domain, credential, suppression, and KYC gates as a live send.
   - Never use `send_email` for a sandbox send because it has no sandbox mode.
   - Do not claim that MCP can set `Idempotency-Key` or `X-Capsule-Cluster-Id`.
   - Do not try to send through SMTP with MCP.
6. If the call returns `credential_missing`, use the `postshiba-create-credentials` workflow before retrying once. Stop on any other gate error and report its `error`, `field`, and `message`.
7. Confirm that success returns `queued: false`. State that PostShiba composed and validated the message but did not inject or deliver it.
