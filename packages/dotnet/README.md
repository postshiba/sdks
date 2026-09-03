# PostShiba

.NET client for the PostShiba API.

## Installation

```xml
<ItemGroup>
  <PackageReference Include="PostShiba" Version="0.1.0" />
</ItemGroup>
```

Not on NuGet yet. Clone [postshiba/postshiba-dotnet](https://github.com/postshiba/postshiba-dotnet) and add a project reference to `src/PostShiba/PostShiba.csproj`. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

`Client` sends JSON to `https://app.postshiba.com` with a Bearer token. Pass `teamId` for team-scoped routes. `GET /users/me` does not return a team id.

## Send an email

```csharp
var client = new Client(apiKey, teamId: "KjkAJW");

await client.Emails.SendAsync(new Dictionary<string, object?>
{
	["from"] = "hello@mail.example.com",
	["to"] = new[] { "you@example.com" },
	["subject"] = "Hi",
	["text"] = "hello"
});
```

Pass a cluster id to pin `X-Capsule-Cluster-Id`. Omit it and the header is not sent.

```csharp
await client.Emails.SendAsync(body, clusterId: "NmQpXr");
```

## API

```csharp
var client = new Client(apiKey, baseUrl: null, teamId: "KjkAJW", httpClient: http);

await client.Users.MeAsync();

await client.Emails.SendOnClusterAsync("NmQpXr", body, idempotencyKey: "idem-1", sandbox: true);

await client.Clusters.ListAsync();
await client.Clusters.GetAsync("NmQpXr");
await client.Clusters.CreateAsync(body);
await client.Clusters.UpdateAsync("NmQpXr", body);
await client.Clusters.SuspendAsync("NmQpXr");
await client.Clusters.ResumeAsync("NmQpXr");
await client.Clusters.DeleteAsync("NmQpXr");

await client.SendingDomains.ListAsync();
await client.SendingDomains.GetAsync("HsVtYk");
await client.SendingDomains.CreateAsync(body);
await client.SendingDomains.VerifyAsync("HsVtYk");
await client.SendingDomains.SuspendAsync("HsVtYk");
await client.SendingDomains.ResumeAsync("HsVtYk");
await client.SendingDomains.MakePrimaryAsync("HsVtYk");
await client.SendingDomains.DeleteAsync("HsVtYk");

await client.Tenants.ListAsync();
await client.Tenants.GetAsync("WbLcFd");
await client.Tenants.CreateAsync(body);
await client.Tenants.DeleteAsync("WbLcFd");

await client.Inboxes.ListAsync();
await client.Inboxes.GetAsync("PqRzMn");
await client.Inboxes.CreateAsync(body);
await client.Inboxes.VerifyAsync("PqRzMn");
await client.Inboxes.DeleteAsync("PqRzMn");

await client.Messages.ListAsync("PqRzMn");
await client.Messages.GetAsync("PqRzMn", "GxTyVu");
await client.Messages.DownloadAttachmentAsync("PqRzMn", "GxTyVu", 1);

await client.Events.ListAsync("NmQpXr");
await client.Events.GetAsync("JkLmNp");

await client.SmtpCredentials.CreateAsync("NmQpXr", body);
await client.SmtpCredentials.DeleteAsync("NmQpXr", "RvWsXq");

await client.Webhooks.ListAsync();
await client.Webhooks.GetAsync("CdFgHj");
await client.Webhooks.CreateAsync(body);
await client.Webhooks.UpdateAsync("CdFgHj", body);
await client.Webhooks.DeleteAsync("CdFgHj");
await client.Webhooks.UpdateAsync("CdFgHj", body);
await client.Webhooks.DeleteAsync("CdFgHj");

await client.Suppressions.ListAsync();
await client.Suppressions.CreateAsync(body);
await client.Suppressions.DeleteAsync("YtReWq");

await client.Firewall.GetAsync();
await client.Firewall.UpdateAsync(body);
await client.Firewall.AddEntryAsync(body);
await client.Firewall.DeleteEntryAsync("BnMkLo");
```

## Verify webhooks

```csharp
var ok = Webhooks.Verify(secret, timestamp, signature, rawBody);
```

HMAC-SHA256 of `{timestamp}.{rawBody}` compared to `X-Capsule-Signature` after a `sha256=` prefix is stripped.

## Errors and throttling

Non-2xx responses throw `ApiException` with `Error`, `Field`, and `Message`.

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. The client does not delay for you. In a queued job, catch `ApiException` and check `e.Error == "throttled"` before sending again.

## Contributing

```sh
dotnet test --nologo
```
