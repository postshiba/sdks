---
name: postshiba-create-credentials
description: Issues a new one-time SMTP username and password for a selected PostShiba cluster. Applies when a user needs SMTP credentials or cannot recover the hidden default credential password.
---

# Create SMTP credentials

Use the `postshiba` hub skill for the MCP connection, token scope, and shared safety rules.

1. Use the cluster id supplied by the user. If none was supplied, call `list_clusters` and select the intended cluster with the user.
2. If the user names a tenant, use its id. Otherwise let `create_smtp_credential` use the team's default tenant.
3. Call `create_smtp_credential` with the selected cluster id.
4. Return the username and password once, and tell the user to place them in the application's secret store.
   - Do not write the password to source control, logs, or generated configuration.
   - Cluster creation already issued a default SMTP user but hid its password. Do not try to reveal or reuse that hidden password.
   - MCP cannot reveal the new password after this response if it is lost. Create another credential instead.
5. Report the credential id, cluster id, and tenant without repeating the password.
6. Do not try to send SMTP through MCP. MCP can create the credential, but it is not an SMTP client.
