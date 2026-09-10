---
name: postshiba-import-dkim
description: Imports an existing RSA DKIM key into a PostShiba sending domain and verifies the required DNS records. Applies when a user migrates a sending domain while keeping its current DKIM selector and private key.
---

# Import DKIM

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Collect the fully qualified sending domain, current selector, and RSA private key in PEM format.
   - Treat the PEM as a secret. Do not save it to source control, logs, or generated files.
   - MCP redacts private keys in every response and cannot reveal the key later.
2. Call `list_sending_domains` and match the exact domain.
3. Choose the matching write operation.
   - If the domain is new, call `create_sending_domain` with `dkim_manual: true`, `dkim_selector`, and `dkim_private_key`.
   - If the domain exists, warn that changing DKIM immediately breaks authentication and sending until DNS verifies. After the user confirms the migration, call `update_sending_domain` with the same three fields.
4. Show the exact `dkim_txt` value from the response. Tell the user to publish it as a TXT record at `{selector}._domainkey.{domain}`, not as a CNAME.
5. Show the returned return-path CNAME when it is not already verified.
6. State that MCP cannot publish DNS. Stop and ask the user to publish the TXT and any required return-path CNAME.
7. Do not call `verify_sending_domain` until the user explicitly confirms that the records are published.
8. After confirmation, call `verify_sending_domain`. Continue only when DKIM and return-path report verified. If either is pending or failed, report the returned status and verification error, then stop.
9. Do not call `refresh_sending_domain` during the import. Refreshing issues new keys and breaks authentication and sending until the user publishes the replacement TXT and verifies again.
