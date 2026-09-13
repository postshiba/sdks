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
        Assert.Equal(66, ops.Count);

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
        yield return JsonOp("emails.sendOnCluster", HttpMethod.Post, "/api/v1/teams/KjkAJW/clusters/NmQpXr/sends", c => c.Emails.SendOnClusterAsync("NmQpXr", Catalog.Json("email_send_request")), "email_sandbox_response");
        yield return JsonOp("clusters.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/clusters", c => c.Clusters.ListAsync(), Catalog.Array("cluster"));
        yield return JsonOp("clusters.get", HttpMethod.Get, "/api/v1/clusters/NmQpXr", c => c.Clusters.GetAsync("NmQpXr"), "cluster");
        yield return JsonOp("clusters.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/clusters", c => c.Clusters.CreateAsync(Catalog.Json("cluster_create_request")), "cluster", "cluster_create_request");
        yield return JsonOp("clusters.update", HttpMethod.Patch, "/api/v1/clusters/NmQpXr", c => c.Clusters.UpdateAsync("NmQpXr", Catalog.Json("cluster_update_request")), "cluster_updated", "cluster_update_request");
        yield return JsonOp("clusters.suspend", HttpMethod.Post, "/api/v1/clusters/NmQpXr/suspend", c => c.Clusters.SuspendAsync("NmQpXr"), "cluster_suspended");
        yield return JsonOp("clusters.resume", HttpMethod.Post, "/api/v1/clusters/NmQpXr/resume", c => c.Clusters.ResumeAsync("NmQpXr"), "cluster");
        yield return JsonOp("clusters.delete", HttpMethod.Delete, "/api/v1/clusters/NmQpXr", c => c.Clusters.DeleteAsync("NmQpXr"), "cluster_deprovisioned");
        yield return JsonOp("clusters.boost", HttpMethod.Post, "/api/v1/clusters/NmQpXr/boost", c => c.Clusters.BoostAsync("NmQpXr", Catalog.Json("cluster_boost_request")), "cluster_boosted", "cluster_boost_request");
        yield return JsonOp("clusters.extendBoost", HttpMethod.Post, "/api/v1/clusters/NmQpXr/extend_boost", c => c.Clusters.ExtendBoostAsync("NmQpXr", Catalog.Json("cluster_extend_boost_request")), "cluster_boosted", "cluster_extend_boost_request");
        yield return JsonOp("clusters.cancelBoost", HttpMethod.Post, "/api/v1/clusters/NmQpXr/cancel_boost", c => c.Clusters.CancelBoostAsync("NmQpXr"), "cluster");
        yield return JsonOp("network.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/network", c => c.Network.ListAsync(), Catalog.Array("network"));
        yield return JsonOp("network.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/network", c => c.Network.CreateAsync(Catalog.Json("network_create_request")), "network_assigned", "network_create_request");
        yield return JsonOp("network.assign", HttpMethod.Post, "/api/v1/teams/KjkAJW/network/assign", c => c.Network.AssignAsync(Catalog.Json("network_create_request")), "network_dedicated", "network_create_request");
        yield return JsonOp("network.unassign", HttpMethod.Post, "/api/v1/teams/KjkAJW/network/unassign", c => c.Network.UnassignAsync(Catalog.Json("network_create_request")), "network", "network_create_request");
        yield return JsonOp("network.switch", HttpMethod.Post, "/api/v1/teams/KjkAJW/network/switch", c => c.Network.SwitchAsync(Catalog.Json("network_create_request")), "network_assigned", "network_create_request");
        yield return JsonOp("network.release", HttpMethod.Post, "/api/v1/teams/KjkAJW/network/release", c => c.Network.ReleaseAsync(Catalog.Json("network_release_request")), "network_released", "network_release_request");
        yield return JsonOp("sendingDomains.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/sending_domains", c => c.SendingDomains.ListAsync(), Catalog.Array("sending_domain"));
        yield return JsonOp("sendingDomains.get", HttpMethod.Get, "/api/v1/sending_domains/HsVtYk", c => c.SendingDomains.GetAsync("HsVtYk"), "sending_domain");
        yield return JsonOp("sendingDomains.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/sending_domains", c => c.SendingDomains.CreateAsync(Catalog.Json("sending_domain_create_request")), "sending_domain", "sending_domain_create_request");
        yield return JsonOp("sendingDomains.update", HttpMethod.Patch, "/api/v1/sending_domains/HsVtYk", c => c.SendingDomains.UpdateAsync("HsVtYk", Catalog.Json("sending_domain_update_request")), "sending_domain_updated", "sending_domain_update_request");
        yield return JsonOp("sendingDomains.refresh", HttpMethod.Post, "/api/v1/sending_domains/HsVtYk/refresh", c => c.SendingDomains.RefreshAsync("HsVtYk"), "sending_domain");
        yield return JsonOp("sendingDomains.verify", HttpMethod.Post, "/api/v1/sending_domains/HsVtYk/verify", c => c.SendingDomains.VerifyAsync("HsVtYk"), "sending_domain");
        yield return JsonOp("sendingDomains.suspend", HttpMethod.Post, "/api/v1/sending_domains/HsVtYk/suspend", c => c.SendingDomains.SuspendAsync("HsVtYk"), "sending_domain_suspended");
        yield return JsonOp("sendingDomains.resume", HttpMethod.Post, "/api/v1/sending_domains/HsVtYk/resume", c => c.SendingDomains.ResumeAsync("HsVtYk"), "sending_domain");
        yield return JsonOp("sendingDomains.makePrimary", HttpMethod.Post, "/api/v1/sending_domains/HsVtYk/make_primary", c => c.SendingDomains.MakePrimaryAsync("HsVtYk"), "sending_domain_primary");
        yield return JsonOp("sendingDomains.delete", HttpMethod.Delete, "/api/v1/sending_domains/HsVtYk", c => c.SendingDomains.DeleteAsync("HsVtYk"), "empty");
        yield return JsonOp("tenants.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/tenants", c => c.Tenants.ListAsync(), Catalog.Array("tenant"));
        yield return JsonOp("tenants.get", HttpMethod.Get, "/api/v1/tenants/WbLcFd", c => c.Tenants.GetAsync("WbLcFd"), "tenant");
        yield return JsonOp("tenants.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/tenants", c => c.Tenants.CreateAsync(Catalog.Json("tenant_create_request")), "tenant", "tenant_create_request");
        yield return JsonOp("tenants.delete", HttpMethod.Delete, "/api/v1/tenants/WbLcFd", c => c.Tenants.DeleteAsync("WbLcFd"), "empty");
        yield return JsonOp("inboxes.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/inboxes", c => c.Inboxes.ListAsync(), Catalog.Array("inbox_index"));
        yield return JsonOp("inboxes.get", HttpMethod.Get, "/api/v1/inboxes/PqRzMn", c => c.Inboxes.GetAsync("PqRzMn"), "inbox");
        yield return JsonOp("inboxes.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/inboxes", c => c.Inboxes.CreateAsync(Catalog.Json("inbox_create_request")), "inbox", "inbox_create_request");
        yield return JsonOp("inboxes.verify", HttpMethod.Post, "/api/v1/inboxes/PqRzMn/verify", c => c.Inboxes.VerifyAsync("PqRzMn"), "inbox_index");
        yield return JsonOp("inboxes.delete", HttpMethod.Delete, "/api/v1/inboxes/PqRzMn", c => c.Inboxes.DeleteAsync("PqRzMn"), "inbox_index");
        yield return JsonOp("messages.list", HttpMethod.Get, "/api/v1/inboxes/PqRzMn/inbound_messages", c => c.Messages.ListAsync("PqRzMn"), Catalog.Array("message"));
        yield return JsonOp("messages.get", HttpMethod.Get, "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu", c => c.Messages.GetAsync("PqRzMn", "GxTyVu"), "message_show");
        yield return new Op(
            "messages.downloadAttachment",
            HttpMethod.Get,
            "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1",
            _ => Task.FromResult(default(JsonElement)),
            "{}",
            null,
            true,
            c => c.Messages.DownloadAttachmentAsync("PqRzMn", "GxTyVu", 1));
        yield return JsonOp("events.listTeam", HttpMethod.Get, "/api/v1/teams/KjkAJW/message_events", c => c.Events.ListTeamAsync(), Catalog.Array("event"));
        yield return JsonOp("events.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events", c => c.Events.ListAsync("NmQpXr"), Catalog.Array("event"));
        yield return JsonOp("events.get", HttpMethod.Get, "/api/v1/message_events/JkLmNp", c => c.Events.GetAsync("JkLmNp"), "event");
        yield return JsonOp("smtpCredentials.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials", c => c.SmtpCredentials.CreateAsync("NmQpXr", Catalog.Json("smtp_credential_create_request")), "smtp_credential_create", "smtp_credential_create_request");
        yield return JsonOp("smtpCredentials.delete", HttpMethod.Delete, "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq", c => c.SmtpCredentials.DeleteAsync("NmQpXr", "RvWsXq"), "smtp_credential_deleted");
        yield return JsonOp("webhooks.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/webhook_endpoints", c => c.Webhooks.ListAsync(), Catalog.Array("webhook"));
        yield return JsonOp("webhooks.get", HttpMethod.Get, "/api/v1/webhook_endpoints/CdFgHj", c => c.Webhooks.GetAsync("CdFgHj"), "webhook_show");
        yield return JsonOp("webhooks.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/webhook_endpoints", c => c.Webhooks.CreateAsync(Catalog.Json("webhook_create_request")), "webhook_show", "webhook_create_request");
        yield return JsonOp("webhooks.update", HttpMethod.Patch, "/api/v1/webhook_endpoints/CdFgHj", c => c.Webhooks.UpdateAsync("CdFgHj", Catalog.Json("webhook_update_request")), "webhook", "webhook_update_request");
        yield return JsonOp("webhooks.delete", HttpMethod.Delete, "/api/v1/webhook_endpoints/CdFgHj", c => c.Webhooks.DeleteAsync("CdFgHj"), "empty");
        yield return JsonOp("templates.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/templates", c => c.Templates.ListAsync(), Catalog.Array("template"));
        yield return JsonOp("templates.get", HttpMethod.Get, "/api/v1/templates/TpLmQr", c => c.Templates.GetAsync("TpLmQr"), "template");
        yield return JsonOp("templates.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/templates", c => c.Templates.CreateAsync(Catalog.Json("template_create_request")), "template", "template_create_request");
        yield return JsonOp("templates.update", HttpMethod.Patch, "/api/v1/templates/TpLmQr", c => c.Templates.UpdateAsync("TpLmQr", Catalog.Json("template_update_request")), "template_updated", "template_update_request");
        yield return JsonOp("templates.publish", HttpMethod.Post, "/api/v1/templates/TpLmQr/publish", c => c.Templates.PublishAsync("TpLmQr"), "template");
        yield return JsonOp("templates.duplicate", HttpMethod.Post, "/api/v1/templates/TpLmQr/duplicate", c => c.Templates.DuplicateAsync("TpLmQr"), "template_duplicated");
        yield return JsonOp("templates.delete", HttpMethod.Delete, "/api/v1/templates/TpLmQr", c => c.Templates.DeleteAsync("TpLmQr"), "empty");
        yield return JsonOp("suppressions.list", HttpMethod.Get, "/api/v1/teams/KjkAJW/suppressions", c => c.Suppressions.ListAsync(), Catalog.Array("suppression"));
        yield return JsonOp("suppressions.create", HttpMethod.Post, "/api/v1/teams/KjkAJW/suppressions", c => c.Suppressions.CreateAsync(Catalog.Json("suppression_create_request")), "suppression", "suppression_create_request");
        yield return JsonOp("suppressions.import", HttpMethod.Post, "/api/v1/teams/KjkAJW/suppressions/import", c => c.Suppressions.ImportAsync(Catalog.Json("suppression_import_request")), "suppression_import", "suppression_import_request");
        yield return JsonOp("suppressions.delete", HttpMethod.Delete, "/api/v1/suppressions/YtReWq", c => c.Suppressions.DeleteAsync("YtReWq"), "empty");
        yield return JsonOp("firewall.get", HttpMethod.Get, "/api/v1/teams/KjkAJW/firewall", c => c.Firewall.GetAsync(), "firewall");
        yield return JsonOp("firewall.update", HttpMethod.Patch, "/api/v1/teams/KjkAJW/firewall", c => c.Firewall.UpdateAsync(Catalog.Json("firewall_update_request")), "firewall", "firewall_update_request");
        yield return JsonOp("firewall.addEntry", HttpMethod.Post, "/api/v1/teams/KjkAJW/firewall_entries", c => c.Firewall.AddEntryAsync(Catalog.Json("firewall_entry_create_request")), "firewall_entry", "firewall_entry_create_request");
        yield return JsonOp("firewall.deleteEntry", HttpMethod.Delete, "/api/v1/firewall_entries/BnMkLo", c => c.Firewall.DeleteEntryAsync("BnMkLo"), "empty");
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
