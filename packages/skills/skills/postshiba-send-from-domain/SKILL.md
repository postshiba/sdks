---
name: postshiba-send-from-domain
description: Sets up and verifies a sending domain, then sends from an address on that domain after DNS and account gates pass. Applies when a user asks to send PostShiba mail from a custom domain.
---

# Send from a domain

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Collect the fully qualified sending domain and the intended `From` address.
   - Never use the `whoami` email as `From`.
   - Never use a hosted `inbound.postshiba.com` inbox as `From` or `MAIL FROM`.
2. Call `list_sending_domains`.
   - If the exact domain exists, keep its id and current DNS status. If DKIM and return-path already report verified, skip to the send steps.
   - For a new PostShiba key, call `create_sending_domain` without `dkim_manual` or `dkim_private_key`.
   - To bring an existing key, warn that updating a live domain interrupts authentication and sending until DNS verifies. After the user confirms the migration, call `create_sending_domain` or `update_sending_domain` with `dkim_manual: true`, the current `dkim_selector`, and the RSA PEM in `dkim_private_key`. Do not persist the key. MCP redacts it from responses.
3. Show the user the exact records returned for the selected mode.
   - For a new key, show the DKIM CNAME and return-path CNAME hosts and targets.
   - For an imported key, show a TXT at `{selector}._domainkey.{domain}` matching `dkim_txt`, not a DKIM CNAME. Also show the return-path CNAME.
4. State that MCP cannot publish DNS. Stop and ask the user to publish the records.
5. Do not call `verify_sending_domain` until the user explicitly confirms that the records are published.
6. After confirmation, call `verify_sending_domain`. Continue only when DKIM and return-path report verified. If either is pending or failed, report the current status and verification error, then stop.
7. For a sandbox request, use the `postshiba-send-test-email` workflow.
8. For a live send, call `list_clusters`, then `get_cluster` for the selected cluster. Require `sending_ready: true` and a live SMTP credential.
9. Call `send_on_cluster` with the selected cluster id, an address on the verified domain as `from`, and the user-approved message. Omit `sandbox` or set it to false.
   - Until the team is approved, send only to team member emails and live inbox addresses.
   - MCP cannot set `Idempotency-Key` or `X-Capsule-Cluster-Id`.
   - Do not try to send through SMTP with MCP.
