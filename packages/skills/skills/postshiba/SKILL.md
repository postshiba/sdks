---
name: postshiba
description: Manages PostShiba email infrastructure and transactional sending through MCP. Use when a user mentions PostShiba, email sending, Liquid templates, clusters, capacity boosts, sending IPs, sending domains, DNS verification, SMTP credentials, hosted inboxes, inbound messages, delivery events, webhooks, suppressions, or firewalls.
---

# PostShiba

Use the PostShiba MCP server for catalog API work. The platform application token selects the team, so do not ask for or pass a team id.

## Start

1. Call `whoami` to confirm that the token works.
2. Select the MCP tools from the workflow table.
3. Read [tools.md](tools.md) when you need the complete tool registry or the matching REST route.
4. Report API errors with their `error`, `field`, and `message` values.

## Workflow lookup

| Goal | MCP tools |
| --- | --- |
| Confirm identity | `whoami` |
| Send a message | `send_email`, `send_template_email`, `send_on_cluster` |
| Manage Liquid templates | `list_email_templates`, `get_email_template`, `create_email_template`, `update_email_template`, `publish_email_template`, `duplicate_email_template`, `destroy_email_template` |
| Manage clusters | `list_clusters`, `get_cluster`, `create_cluster`, `update_cluster`, `suspend_cluster`, `resume_cluster`, `destroy_cluster`, `boost_cluster`, `extend_boost_cluster`, `cancel_boost_cluster` |
| Manage sending IPs | `list_network`, `create_network`, `assign_network`, `unassign_network`, `switch_network`, `release_network` |
| Manage sending domains | `list_sending_domains`, `get_sending_domain`, `create_sending_domain`, `update_sending_domain`, `refresh_sending_domain`, `verify_sending_domain`, `suspend_sending_domain`, `resume_sending_domain`, `make_primary_sending_domain`, `can_i_send_this_sending_domain`, `can_i_send_this_poll_sending_domain`, `destroy_sending_domain` |
| Manage tenants | `list_tenants`, `get_tenant`, `create_tenant`, `suspend_tenant`, `resume_tenant`, `destroy_tenant` |
| Manage inboxes | `list_inboxes`, `get_inbox`, `create_inbox`, `verify_inbox`, `destroy_inbox` |
| Read inbound mail | `list_inbound_messages`, `get_inbound_message`, `download_attachment_inbound_message` |
| Read delivery events | `list_team_message_events`, `list_message_events`, `get_message_event` |
| Manage SMTP credentials | `create_smtp_credential`, `destroy_smtp_credential` |
| Manage delivery webhooks | `list_webhook_endpoints`, `get_webhook_endpoint`, `create_webhook_endpoint`, `update_webhook_endpoint`, `destroy_webhook_endpoint` |
| Manage suppressions | `list_suppressions`, `create_suppression`, `import_suppression`, `destroy_suppression` |
| Manage the recipient firewall | `get_firewall`, `update_firewall`, `create_firewall_entry`, `destroy_firewall_entry` |

## Hard rules

### Account gates

- Apply the same KYC, payment, and sending gates as the dashboard.
- A pending team can create one shared-IP cluster and can create inboxes.
- Until KYC approval, send only to team member emails and live inbox addresses. Other recipients return `kyc_required`.
- A second cluster for a pending team returns `kyc_required`.
- Stop on `payment_required`. Payment setup is not an MCP action.

### DNS and secrets

- MCP cannot publish DNS. After `create_sending_domain`, ask the user to publish the DKIM and return-path records, then call `verify_sending_domain`.
- Default DKIM uses the returned CNAME. With `dkim_manual`, ask the user to publish `dkim_txt` as TXT at the selector.
- MCP redacts inbox secrets, webhook secrets, and private keys. Direct the user to the dashboard for inbox and webhook secrets.
- Cluster creation hides the default SMTP password. Use `create_smtp_credential` when the user needs a password, and tell the user to save the returned password immediately because it appears once.

### Sending

- `send_email` has no sandbox mode.
- `send_template_email` posts the same `/emails` path with `template.id` (alias or public id) and Liquid `variables`. Do not pass `html` or `text`. The template must be published. `from`, `subject`, and `reply_to` on the request override the template.
- Create a draft with `create_email_template`, edit with `update_email_template`, then `publish_email_template` before send. Drafts cannot send.
- Use `send_on_cluster` with `sandbox: true` for a sandbox send.
- MCP cannot set `Idempotency-Key` or `X-Capsule-Cluster-Id`.
- Never use the email returned by `whoami` as `from`. Omit `from`, or use an address on a verified sending domain.
- A hosted inbox is inbound only. MAIL FROM must use a verified sending domain.
- `create_inbox` may pass `host` and `forward_to` for a domain-bound inbox. Omit `sending_domain_id` (and those fields) to keep the inbox hosted.
