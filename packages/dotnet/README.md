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
var client = new Client(apiKey, teamId: "1");

await client.Emails.SendAsync(new Dictionary<string, object?>
{
	["from"] = "hello@mail.example.com",
	["to"] = new[] { "you@example.com" },
	["subject"] = "Hi",
	["text"] = "hello"
});
```

## API

```csharp
var client = new Client(apiKey, baseUrl: null, teamId: "1", httpClient: http);

await client.Users.MeAsync();

await client.Emails.SendOnClusterAsync("4", body, idempotencyKey: "idem-1", sandbox: true);

await client.Clusters.ListAsync();
await client.Clusters.GetAsync("4");
await client.Clusters.CreateAsync(body);
await client.Clusters.UpdateAsync("4", body);
await client.Clusters.SuspendAsync("4");
await client.Clusters.ResumeAsync("4");
await client.Clusters.DeleteAsync("4");

await client.SendingDomains.ListAsync();
await client.SendingDomains.GetAsync("8");
await client.SendingDomains.CreateAsync(body);
await client.SendingDomains.VerifyAsync("8");
await client.SendingDomains.SuspendAsync("8");
await client.SendingDomains.ResumeAsync("8");
await client.SendingDomains.MakePrimaryAsync("8");
await client.SendingDomains.DeleteAsync("8");

await client.Tenants.ListAsync();
await client.Tenants.GetAsync("12");
await client.Tenants.CreateAsync(body);
await client.Tenants.DeleteAsync("12");

await client.Inboxes.ListAsync();
await client.Inboxes.GetAsync("3");
await client.Inboxes.CreateAsync(body);
await client.Inboxes.VerifyAsync("3");
await client.Inboxes.DeleteAsync("3");

await client.Messages.ListAsync("3");
await client.Messages.GetAsync("3", "21");
await client.Messages.DownloadAttachmentAsync("3", "21", 1);

await client.Events.ListAsync("4");
await client.Events.GetAsync("44");

await client.SmtpCredentials.CreateAsync("4", body);
await client.SmtpCredentials.DeleteAsync("4", "9");

await client.Webhooks.ListAsync();
await client.Webhooks.GetAsync("2");
await client.Webhooks.CreateAsync(body);
await client.Webhooks.UpdateAsync("2", body);
await client.Webhooks.DeleteAsync("2");
await client.Webhooks.UpdateAsync("2", body);
await client.Webhooks.DeleteAsync("2");

await client.Suppressions.ListAsync();
await client.Suppressions.CreateAsync(body);
await client.Suppressions.DeleteAsync("7");

await client.Firewall.GetAsync();
await client.Firewall.UpdateAsync(body);
await client.Firewall.AddEntryAsync(body);
await client.Firewall.DeleteEntryAsync("3");
```

## Verify webhooks

```csharp
var ok = Webhooks.Verify(secret, timestamp, signature, rawBody);
```

HMAC-SHA256 of `{timestamp}.{rawBody}` compared to `X-Capsule-Signature` after a `sha256=` prefix is stripped.

## Errors

Non-2xx responses throw `ApiException` with `Error`, `Field`, and `Message`.

## Contributing

```sh
dotnet test --nologo
```
