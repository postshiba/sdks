# PostShiba for Cursor

Connect Cursor to PostShiba's remote MCP server and load instructions for email infrastructure and sending.

## Install the Cursor plugin

1. Clone the SDK repository and copy the package into Cursor's local plugin directory.

```bash
git clone https://github.com/postshiba/sdks.git
cd sdks
mkdir -p ~/.cursor/plugins/local/postshiba
cp -R packages/skills/. ~/.cursor/plugins/local/postshiba/
```

2. Restart Cursor or run **Developer: Reload Window**.
3. Open **Cursor Settings**, select **Plugins**, and configure `POSTSHIBA_API_KEY`.

Create the token in the PostShiba dashboard under **Developers** -> **Platform applications**. Copy the access token, not the application uid or secret.

## Copy only the skills

To install the instructions without the plugin, copy the skills into your personal skills directory.

```bash
mkdir -p ~/.cursor/skills
cp -R packages/skills/skills/. ~/.cursor/skills/
```

Restart Cursor or run **Developer: Reload Window**. This method does not install the MCP server. Configure `https://app.postshiba.com/mcp` separately, or install the full plugin.

## MCP limits

PostShiba MCP cannot:

- Complete KYC or payment setup.
- Publish DNS records.
- Return inbox or webhook secrets.
- Return the default SMTP password created with a cluster.
- Send through SMTP or HTTP inject.
- Set `Idempotency-Key` or `X-Capsule-Cluster-Id`.
- Run a sandbox send with `send_email`. Use `send_on_cluster` with `sandbox: true`.

Hosted inboxes receive mail only. Send mail from a verified sending domain.

## Contributing

Open pull requests in [postshiba/sdks](https://github.com/postshiba/sdks).
