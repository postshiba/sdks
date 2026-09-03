using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace PostShiba;

public sealed class Client : IDisposable
{
    public const string DefaultBaseUrl = "https://postshiba.com";

    static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = null
    };

    readonly string _apiKey;
    readonly string _baseUrl;
    readonly string? _teamId;
    readonly HttpClient _http;
    readonly bool _ownsHttp;

    public Client(string apiKey, string? baseUrl = null, string? teamId = null, HttpClient? httpClient = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(apiKey);
        _apiKey = apiKey;
        _baseUrl = (baseUrl ?? DefaultBaseUrl).TrimEnd('/');
        _teamId = teamId;
        _ownsHttp = httpClient is null;
        _http = httpClient ?? new HttpClient();
        Users = new UsersResource(this);
        Emails = new EmailsResource(this);
        Clusters = new ClustersResource(this);
        SendingDomains = new SendingDomainsResource(this);
        Tenants = new TenantsResource(this);
        Inboxes = new InboxesResource(this);
        Messages = new MessagesResource(this);
        Events = new EventsResource(this);
        SmtpCredentials = new SmtpCredentialsResource(this);
        Webhooks = new WebhooksResource(this);
        Suppressions = new SuppressionsResource(this);
        Firewall = new FirewallResource(this);
    }

    public UsersResource Users { get; }
    public EmailsResource Emails { get; }
    public ClustersResource Clusters { get; }
    public SendingDomainsResource SendingDomains { get; }
    public TenantsResource Tenants { get; }
    public InboxesResource Inboxes { get; }
    public MessagesResource Messages { get; }
    public EventsResource Events { get; }
    public SmtpCredentialsResource SmtpCredentials { get; }
    public WebhooksResource Webhooks { get; }
    public SuppressionsResource Suppressions { get; }
    public FirewallResource Firewall { get; }

    internal string Team(string suffix)
    {
        if (string.IsNullOrEmpty(_teamId))
            throw new InvalidOperationException("teamId is required");
        return $"/api/v1/teams/{_teamId}{suffix}";
    }

    internal async Task<JsonElement> SendAsync(
        HttpMethod method,
        string path,
        object? body = null,
        bool sandbox = false,
        string? idempotencyKey = null,
        CancellationToken cancellationToken = default)
    {
        var text = await SendRawAsync(method, path, body, sandbox, idempotencyKey, cancellationToken);
        if (string.IsNullOrWhiteSpace(text))
            text = "{}";
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    internal async Task<byte[]> SendBytesAsync(
        HttpMethod method,
        string path,
        CancellationToken cancellationToken = default)
    {
        using var request = BuildRequest(method, path, body: null, sandbox: false, idempotencyKey: null);
        using var response = await _http.SendAsync(request, cancellationToken);
        var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw ToApiException(Encoding.UTF8.GetString(bytes));
        return bytes;
    }

    async Task<string> SendRawAsync(
        HttpMethod method,
        string path,
        object? body,
        bool sandbox,
        string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        using var request = BuildRequest(method, path, body, sandbox, idempotencyKey);
        using var response = await _http.SendAsync(request, cancellationToken);
        var text = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw ToApiException(text);
        return text;
    }

    HttpRequestMessage BuildRequest(
        HttpMethod method,
        string path,
        object? body,
        bool sandbox,
        string? idempotencyKey)
    {
        var request = new HttpRequestMessage(method, _baseUrl + path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        if (idempotencyKey is not null)
            request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);

        if (body is not null || sandbox)
        {
            var json = SerializeBody(body, sandbox);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return request;
    }

    static string SerializeBody(object? body, bool sandbox)
    {
        JsonNode node = body is null
            ? new JsonObject()
            : JsonSerializer.SerializeToNode(body, JsonOptions) ?? new JsonObject();

        if (sandbox)
        {
            if (node is not JsonObject obj)
            {
                obj = new JsonObject();
                node = obj;
            }
            obj["sandbox"] = true;
        }

        return node.ToJsonString();
    }

    static ApiException ToApiException(string text)
    {
        string? error = null;
        string? field = null;
        string? message = text;
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(text) ? "{}" : text);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
            {
                if (doc.RootElement.TryGetProperty("error", out var errorEl))
                    error = errorEl.GetString();
                if (doc.RootElement.TryGetProperty("field", out var fieldEl))
                    field = fieldEl.GetString();
                if (doc.RootElement.TryGetProperty("message", out var messageEl))
                    message = messageEl.GetString();
            }
        }
        catch (JsonException)
        {
        }

        return new ApiException(error, field, message);
    }

    public void Dispose()
    {
        if (_ownsHttp)
            _http.Dispose();
    }
}
