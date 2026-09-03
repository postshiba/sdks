using System.Net;
using System.Text;
using System.Text.Json;

namespace PostShiba.Tests;

static class Catalog
{
    public static string Dir
    {
        get
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null)
            {
                var catalog = Path.Combine(dir.FullName, "fixtures", "catalog");
                if (Directory.Exists(catalog))
                    return catalog;
                dir = dir.Parent;
            }

            var fromPackage = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "fixtures", "catalog"));
            if (Directory.Exists(fromPackage))
                return fromPackage;

            throw new DirectoryNotFoundException("fixtures/catalog");
        }
    }

    public static string Text(string name) => File.ReadAllText(Path.Combine(Dir, name + ".json"));

    public static JsonElement Json(string name)
    {
        using var doc = JsonDocument.Parse(Text(name));
        return doc.RootElement.Clone();
    }

    public static string Array(string name) => $"[{Text(name)}]";
}

sealed class MockHandler : HttpMessageHandler
{
    public HttpMethod? Method { get; private set; }
    public Uri? Uri { get; private set; }
    public string? Authorization { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public string? ClusterId { get; private set; }
    public string? Body { get; private set; }
    public Func<HttpResponseMessage> Respond { get; set; } = () => Json(HttpStatusCode.OK, "{}");

    public static HttpResponseMessage Json(HttpStatusCode status, string body) =>
        new(status)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

    public static HttpResponseMessage Bytes(HttpStatusCode status, byte[] body) =>
        new(status)
        {
            Content = new ByteArrayContent(body)
        };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Method = request.Method;
        Uri = request.RequestUri;
        Authorization = request.Headers.Authorization?.ToString();
        IdempotencyKey = request.Headers.TryGetValues("Idempotency-Key", out var values)
            ? values.First()
            : null;
        ClusterId = request.Headers.TryGetValues("X-Capsule-Cluster-Id", out var clusterValues)
            ? clusterValues.First()
            : null;
        Body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        return Respond();
    }
}

sealed class Harness : IDisposable
{
    public MockHandler Handler { get; } = new();
    public HttpClient Http { get; }
    public Client Client { get; }

    public Harness(string? teamId = "KjkAJW", string? baseUrl = "https://api.example.test", string apiKey = "test-key")
    {
        Http = new HttpClient(Handler);
        Client = new Client(apiKey, baseUrl, teamId, Http);
    }

    public void Dispose()
    {
        Client.Dispose();
        Http.Dispose();
    }
}
