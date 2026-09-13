using System.Text.Json;

namespace PostShiba;

public sealed class UsersResource
{
    readonly Client _client;
    internal UsersResource(Client client) => _client = client;

    public Task<JsonElement> MeAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, "/api/v1/users/me", cancellationToken: cancellationToken);
}

public sealed class EmailsResource
{
    readonly Client _client;
    internal EmailsResource(Client client) => _client = client;

    public Task<JsonElement> SendAsync(
        object body,
        CancellationToken cancellationToken = default,
        string? clusterId = null) =>
        _client.SendAsync(
            HttpMethod.Post,
            "/api/v1/emails",
            body,
            clusterId: clusterId,
            cancellationToken: cancellationToken);

    public Task<JsonElement> SendOnClusterAsync(
        string clusterId,
        object body,
        string? idempotencyKey = null,
        bool sandbox = false,
        CancellationToken cancellationToken = default) =>
        _client.SendAsync(
            HttpMethod.Post,
            _client.Team($"/clusters/{clusterId}/sends"),
            body,
            sandbox,
            idempotencyKey,
            cancellationToken: cancellationToken);
}

public sealed class ClustersResource
{
    readonly Client _client;
    internal ClustersResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/clusters"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/clusters/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/clusters"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> UpdateAsync(string id, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Patch, $"/api/v1/clusters/{id}", body, cancellationToken: cancellationToken);

    public Task<JsonElement> SuspendAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/clusters/{id}/suspend", cancellationToken: cancellationToken);

    public Task<JsonElement> ResumeAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/clusters/{id}/resume", cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/clusters/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> BoostAsync(string id, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/clusters/{id}/boost", body, cancellationToken: cancellationToken);

    public Task<JsonElement> ExtendBoostAsync(string id, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/clusters/{id}/extend_boost", body, cancellationToken: cancellationToken);

    public Task<JsonElement> CancelBoostAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/clusters/{id}/cancel_boost", cancellationToken: cancellationToken);
}

public sealed class NetworkResource
{
    readonly Client _client;
    internal NetworkResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/network"), cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/network"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> AssignAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/network/assign"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> UnassignAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/network/unassign"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> SwitchAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/network/switch"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> ReleaseAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/network/release"), body, cancellationToken: cancellationToken);
}

public sealed class SendingDomainsResource
{
    readonly Client _client;
    internal SendingDomainsResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/sending_domains"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/sending_domains/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/sending_domains"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> UpdateAsync(string id, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Patch, $"/api/v1/sending_domains/{id}", body, cancellationToken: cancellationToken);

    public Task<JsonElement> RefreshAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/sending_domains/{id}/refresh", cancellationToken: cancellationToken);

    public Task<JsonElement> VerifyAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/sending_domains/{id}/verify", cancellationToken: cancellationToken);

    public Task<JsonElement> SuspendAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/sending_domains/{id}/suspend", cancellationToken: cancellationToken);

    public Task<JsonElement> ResumeAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/sending_domains/{id}/resume", cancellationToken: cancellationToken);

    public Task<JsonElement> MakePrimaryAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/sending_domains/{id}/make_primary", cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/sending_domains/{id}", cancellationToken: cancellationToken);
}

public sealed class TenantsResource
{
    readonly Client _client;
    internal TenantsResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/tenants"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/tenants/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/tenants"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/tenants/{id}", cancellationToken: cancellationToken);
}

public sealed class InboxesResource
{
    readonly Client _client;
    internal InboxesResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/inboxes"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/inboxes/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/inboxes"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> VerifyAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/inboxes/{id}/verify", cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/inboxes/{id}", cancellationToken: cancellationToken);
}

public sealed class MessagesResource
{
    readonly Client _client;
    internal MessagesResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(string inboxId, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/inboxes/{inboxId}/inbound_messages", cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string inboxId, string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/inboxes/{inboxId}/inbound_messages/{id}", cancellationToken: cancellationToken);

    public Task<byte[]> DownloadAttachmentAsync(string inboxId, string id, int index, CancellationToken cancellationToken = default) =>
        _client.SendBytesAsync(HttpMethod.Get, $"/api/v1/inboxes/{inboxId}/inbound_messages/{id}/attachments/{index}", cancellationToken);
}

public sealed class EventsResource
{
    readonly Client _client;
    internal EventsResource(Client client) => _client = client;

    public Task<JsonElement> ListTeamAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/message_events"), cancellationToken: cancellationToken);

    public Task<JsonElement> ListAsync(string clusterId, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team($"/clusters/{clusterId}/message_events"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/message_events/{id}", cancellationToken: cancellationToken);
}

public sealed class SmtpCredentialsResource
{
    readonly Client _client;
    internal SmtpCredentialsResource(Client client) => _client = client;

    public Task<JsonElement> CreateAsync(string clusterId, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team($"/clusters/{clusterId}/smtp_credentials"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string clusterId, string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, _client.Team($"/clusters/{clusterId}/smtp_credentials/{id}"), cancellationToken: cancellationToken);
}

public sealed class WebhooksResource
{
    readonly Client _client;
    internal WebhooksResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/webhook_endpoints"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/webhook_endpoints/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/webhook_endpoints"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> UpdateAsync(string id, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Patch, $"/api/v1/webhook_endpoints/{id}", body, cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/webhook_endpoints/{id}", cancellationToken: cancellationToken);
}

public sealed class SuppressionsResource
{
    readonly Client _client;
    internal SuppressionsResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/suppressions"), cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/suppressions"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> ImportAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/suppressions/import"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/suppressions/{id}", cancellationToken: cancellationToken);
}

public sealed class TemplatesResource
{
    readonly Client _client;
    internal TemplatesResource(Client client) => _client = client;

    public Task<JsonElement> ListAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/templates"), cancellationToken: cancellationToken);

    public Task<JsonElement> GetAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, $"/api/v1/templates/{id}", cancellationToken: cancellationToken);

    public Task<JsonElement> CreateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/templates"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> UpdateAsync(string id, object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Patch, $"/api/v1/templates/{id}", body, cancellationToken: cancellationToken);

    public Task<JsonElement> PublishAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/templates/{id}/publish", cancellationToken: cancellationToken);

    public Task<JsonElement> DuplicateAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, $"/api/v1/templates/{id}/duplicate", cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/templates/{id}", cancellationToken: cancellationToken);
}

public sealed class FirewallResource
{
    readonly Client _client;
    internal FirewallResource(Client client) => _client = client;

    public Task<JsonElement> GetAsync(CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Get, _client.Team("/firewall"), cancellationToken: cancellationToken);

    public Task<JsonElement> UpdateAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Patch, _client.Team("/firewall"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> AddEntryAsync(object body, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Post, _client.Team("/firewall_entries"), body, cancellationToken: cancellationToken);

    public Task<JsonElement> DeleteEntryAsync(string id, CancellationToken cancellationToken = default) =>
        _client.SendAsync(HttpMethod.Delete, $"/api/v1/firewall_entries/{id}", cancellationToken: cancellationToken);
}
