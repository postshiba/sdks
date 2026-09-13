---
name: postshiba-create-mailbox
description: Creates a hosted PostShiba inbox without binding a sending domain and explains its inbound-only limits. Applies when a user asks for a mailbox, hosted inbox, or inbound webhook address.
---

# Create a hosted inbox

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Collect the inbox name and any webhook URL the user wants.
2. Call `list_clusters` to check whether an active shared cluster exists for edge routing. Do not make KYC approval a prerequisite for inbox creation.
3. Call `create_inbox` without `sending_domain_id`. Omitting that field keeps the inbox hosted. `forward_to` is for domain-bound inboxes only.
4. Report the inbox id, hosted address, and routing status.
   - Inbox creation is allowed while KYC is pending.
   - An active shared cluster is required before relying on the inbox for edge routing.
5. State that MCP redacts `webhook_secret`. Do not try to reveal it from any MCP response. Tell the user to copy the signing secret from the dashboard inbox page.
6. State that the hosted inbox is inbound-only. Never use its `inbound.postshiba.com` address as `From` or `MAIL FROM`.
