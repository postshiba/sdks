using System.Net;
using System.Text.Json;
using Xunit;

namespace PostShiba.Tests;

public class OperationsTest
{
    [Fact]
    public async Task Every_contract_operation()
    {
        var ops = All().ToList();
        Assert.Equal(46, ops.Count);

        foreach (var op in ops)
        {
            using var harness = new Harness();
            if (op.Binary)
            {
                harness.Handler.Respond = () => MockHandler.Bytes(HttpStatusCode.OK, [1, 2, 3]);
                var bytes = await op.Download!(harness.Client);
                Assert.Equal(new byte[] { 1, 2, 3 }, bytes);
            }
            else
            {
                harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, op.Response);
                var result = await op.Call(harness.Client);
                Assert.NotEqual(JsonValueKind.Undefined, result.ValueKind);
            }

            Assert.True(harness.Handler.Method == op.Method, $"{op.Name} method");
            Assert.True(
                $"https://api.example.test{op.Path}" == harness.Handler.Uri!.ToString(),
                $"{op.Name} path {harness.Handler.Uri}");
            if (op.Request is not null)
                AssertJsonContains(op.Request, harness.Handler.Body!);
        }
    }

    static void AssertJsonContains(string expected, string actual)
    {
        using var expectedDoc = JsonDocument.Parse(expected);
        using var actualDoc = JsonDocument.Parse(actual);
        Assert.Equal(
            JsonSerializer.Serialize(expectedDoc.RootElement),
            JsonSerializer.Serialize(actualDoc.RootElement));
    }

    static IEnumerable<Op> All()
    {
        yield return JsonOp("users.me", HttpMethod.Get, "/api/v1/users/me", c => c.Users.MeAsync(), "whoami");
        yield return JsonOp("emails.send", HttpMethod.Post, "/api/v1/emails", c => c.Emails.SendAsync(Catalog.Json("email_send_request")), "email_send_response", "email_send_request");
        yield return JsonOp("emails.sendOnCluster", HttpMethod.Post, "/api/v1/teams/1/clusters/4/sends", c => c.Emails.SendOnClusterAsync("4", Catalog.Json("email_send_request")), "email_sandbox_response");
        yield return JsonOp("clusters.list", HttpMethod.Get, "/api/v1/teams/1/clusters", c => c.Clusters.ListAsync(), Catalog.Array("cluster"));
        yield return JsonOp("clusters.get", HttpMethod.Get, "/api/v1/clusters/4", c => c.Clusters.GetAsync("4"), "cluster");
        yield return JsonOp("clusters.create", HttpMethod.Post, "/api/v1/teams/1/clusters", c => c.Clusters.CreateAsync(Catalog.Json("cluster_create_request")), "cluster", "cluster_create_request");
        yield return JsonOp("clusters.update", HttpMethod.Patch, "/api/v1/clusters/4", c => c.Clusters.UpdateAsync("4", Catalog.Json("cluster_update_request")), "cluster_updated", "cluster_update_request");
        yield return JsonOp("clusters.suspend", HttpMethod.Post, "/api/v1/clusters/4/suspend", c => c.Clusters.SuspendAsync("4"), "cluster_suspended");
        yield return JsonOp("clusters.resume", HttpMethod.Post, "/api/v1/clusters/4/resume", c => c.Clusters.ResumeAsync("4"), "cluster");
        yield return JsonOp("clusters.delete", HttpMethod.Delete, "/api/v1/clusters/4", c => c.Clusters.DeleteAsync("4"), "cluster_deprovisioned");
        yield return JsonOp("sendingDomains.list", HttpMethod.Get, "/api/v1/teams/1/sending_domains", c => c.SendingDomains.ListAsync(), Catalog.Array("sending_domain"));
        yield return JsonOp("sendingDomains.get", HttpMethod.Get, "/api/v1/sending_domains/8", c => c.SendingDomains.GetAsync("8"), "sending_domain");
        yield return JsonOp("sendingDomains.create", HttpMethod.Post, "/api/v1/teams/1/sending_domains", c => c.SendingDomains.CreateAsync(Catalog.Json("sending_domain_create_request")), "sending_domain", "sending_domain_create_request");
        yield return JsonOp("sendingDomains.verify", HttpMethod.Post, "/api/v1/sending_domains/8/verify", c => c.SendingDomains.VerifyAsync("8"), "sending_domain");
        yield return JsonOp("sendingDomains.suspend", HttpMethod.Post, "/api/v1/sending_domains/8/suspend", c => c.SendingDomains.SuspendAsync("8"), "sending_domain_suspended");
        yield return JsonOp("sendingDomains.resume", HttpMethod.Post, "/api/v1/sending_domains/8/resume", c => c.SendingDomains.ResumeAsync("8"), "sending_domain");
        yield return JsonOp("sendingDomains.makePrimary", HttpMethod.Post, "/api/v1/sending_domains/8/make_primary", c => c.SendingDomains.MakePrimaryAsync("8"), "sending_domain_primary");
        yield return JsonOp("sendingDomains.delete", HttpMethod.Delete, "/api/v1/sending_domains/8", c => c.SendingDomains.DeleteAsync("8"), "empty");
        yield return JsonOp("tenants.list", HttpMethod.Get, "/api/v1/teams/1/tenants", c => c.Tenants.ListAsync(), Catalog.Array("tenant"));
        yield return JsonOp("tenants.get", HttpMethod.Get, "/api/v1/tenants/12", c => c.Tenants.GetAsync("12"), "tenant");
        yield return JsonOp("tenants.create", HttpMethod.Post, "/api/v1/teams/1/tenants", c => c.Tenants.CreateAsync(Catalog.Json("tenant_create_request")), "tenant", "tenant_create_request");
        yield return JsonOp("tenants.delete", HttpMethod.Delete, "/api/v1/tenants/12", c => c.Tenants.DeleteAsync("12"), "empty");
        yield return JsonOp("inboxes.list", HttpMethod.Get, "/api/v1/teams/1/inboxes", c => c.Inboxes.ListAsync(), Catalog.Array("inbox_index"));
        yield return JsonOp("inboxes.get", HttpMethod.Get, "/api/v1/inboxes/3", c => c.Inboxes.GetAsync("3"), "inbox");
        yield return JsonOp("inboxes.create", HttpMethod.Post, "/api/v1/teams/1/inboxes", c => c.Inboxes.CreateAsync(Catalog.Json("inbox_create_request")), "inbox", "inbox_create_request");
        yield return JsonOp("inboxes.verify", HttpMethod.Post, "/api/v1/inboxes/3/verify", c => c.Inboxes.VerifyAsync("3"), "inbox_index");
        yield return JsonOp("inboxes.delete", HttpMethod.Delete, "/api/v1/inboxes/3", c => c.Inboxes.DeleteAsync("3"), "inbox_index");
        yield return JsonOp("messages.list", HttpMethod.Get, "/api/v1/inboxes/3/inbound_messages", c => c.Messages.ListAsync("3"), Catalog.Array("message"));
        yield return JsonOp("messages.get", HttpMethod.Get, "/api/v1/inboxes/3/inbound_messages/21", c => c.Messages.GetAsync("3", "21"), "message_show");
        yield return new Op(
            "messages.downloadAttachment",
            HttpMethod.Get,
            "/api/v1/inboxes/3/inbound_messages/21/attachments/1",
            _ => Task.FromResult(default(JsonElement)),
            "{}",
            null,
            true,
            c => c.Messages.DownloadAttachmentAsync("3", "21", 1));
        yield return JsonOp("events.list", HttpMethod.Get, "/api/v1/teams/1/clusters/4/message_events", c => c.Events.ListAsync("4"), Catalog.Array("event"));
        yield return JsonOp("events.get", HttpMethod.Get, "/api/v1/message_events/44", c => c.Events.GetAsync("44"), "event");
        yield return JsonOp("smtpCredentials.create", HttpMethod.Post, "/api/v1/teams/1/clusters/4/smtp_credentials", c => c.SmtpCredentials.CreateAsync("4", Catalog.Json("smtp_credential_create_request")), "smtp_credential_create", "smtp_credential_create_request");
        yield return JsonOp("smtpCredentials.delete", HttpMethod.Delete, "/api/v1/teams/1/clusters/4/smtp_credentials/9", c => c.SmtpCredentials.DeleteAsync("4", "9"), "smtp_credential_deleted");
        yield return JsonOp("webhooks.list", HttpMethod.Get, "/api/v1/teams/1/webhook_endpoints", c => c.Webhooks.ListAsync(), Catalog.Array("webhook"));
        yield return JsonOp("webhooks.get", HttpMethod.Get, "/api/v1/webhook_endpoints/2", c => c.Webhooks.GetAsync("2"), "webhook_show");
        yield return JsonOp("webhooks.create", HttpMethod.Post, "/api/v1/teams/1/webhook_endpoints", c => c.Webhooks.CreateAsync(Catalog.Json("webhook_create_request")), "webhook_show", "webhook_create_request");
        yield return JsonOp("webhooks.update", HttpMethod.Patch, "/api/v1/webhook_endpoints/2", c => c.Webhooks.UpdateAsync("2", Catalog.Json("webhook_update_request")), "webhook", "webhook_update_request");
        yield return JsonOp("webhooks.delete", HttpMethod.Delete, "/api/v1/webhook_endpoints/2", c => c.Webhooks.DeleteAsync("2"), "empty");
        yield return JsonOp("suppressions.list", HttpMethod.Get, "/api/v1/teams/1/suppressions", c => c.Suppressions.ListAsync(), Catalog.Array("suppression"));
        yield return JsonOp("suppressions.create", HttpMethod.Post, "/api/v1/teams/1/suppressions", c => c.Suppressions.CreateAsync(Catalog.Json("suppression_create_request")), "suppression", "suppression_create_request");
        yield return JsonOp("suppressions.delete", HttpMethod.Delete, "/api/v1/suppressions/7", c => c.Suppressions.DeleteAsync("7"), "empty");
        yield return JsonOp("firewall.get", HttpMethod.Get, "/api/v1/teams/1/firewall", c => c.Firewall.GetAsync(), "firewall");
        yield return JsonOp("firewall.update", HttpMethod.Patch, "/api/v1/teams/1/firewall", c => c.Firewall.UpdateAsync(Catalog.Json("firewall_update_request")), "firewall", "firewall_update_request");
        yield return JsonOp("firewall.addEntry", HttpMethod.Post, "/api/v1/teams/1/firewall_entries", c => c.Firewall.AddEntryAsync(Catalog.Json("firewall_entry_create_request")), "firewall_entry", "firewall_entry_create_request");
        yield return JsonOp("firewall.deleteEntry", HttpMethod.Delete, "/api/v1/firewall_entries/3", c => c.Firewall.DeleteEntryAsync("3"), "empty");
    }

    static Op JsonOp(
        string name,
        HttpMethod method,
        string path,
        Func<Client, Task<JsonElement>> call,
        string response,
        string? request = null)
    {
        var responseBody = response.StartsWith('[') || response.StartsWith('{')
            ? response
            : Catalog.Text(response);
        var requestBody = request is null ? null : Catalog.Text(request);
        return new Op(name, method, path, call, responseBody, requestBody, false, null);
    }

    sealed record Op(
        string Name,
        HttpMethod Method,
        string Path,
        Func<Client, Task<JsonElement>> Call,
        string Response,
        string? Request,
        bool Binary,
        Func<Client, Task<byte[]>>? Download);
}
