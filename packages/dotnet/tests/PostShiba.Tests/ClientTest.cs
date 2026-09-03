using System.Net;
using System.Text.Json;
using Xunit;

namespace PostShiba.Tests;

public class ClientTest
{
    [Fact]
    public async Task Bearer_and_base_url_override()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("whoami"));

        await harness.Client.Users.MeAsync();

        Assert.Equal(HttpMethod.Get, harness.Handler.Method);
        Assert.Equal("https://api.example.test/api/v1/users/me", harness.Handler.Uri!.ToString());
        Assert.Equal("Bearer test-key", harness.Handler.Authorization);
    }

    [Fact]
    public async Task Default_base_url_is_postshiba()
    {
        using var harness = new Harness(baseUrl: null);
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("whoami"));

        await harness.Client.Users.MeAsync();

        Assert.Equal("https://app.postshiba.com/api/v1/users/me", harness.Handler.Uri!.ToString());
    }

    [Fact]
    public async Task Emails_send_happy_path()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("email_send_response"));

        var result = await harness.Client.Emails.SendAsync(Catalog.Json("email_send_request"));

        Assert.Equal(HttpMethod.Post, harness.Handler.Method);
        Assert.Equal("https://api.example.test/api/v1/emails", harness.Handler.Uri!.ToString());
        AssertJsonEqual(Catalog.Text("email_send_request"), harness.Handler.Body!);
        Assert.True(result.GetProperty("queued").GetBoolean());
        Assert.Equal("abc@capsule.test", result.GetProperty("message_id").GetString());
    }

    [Fact]
    public async Task Send_on_cluster_sets_idempotency_key_and_sandbox()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("email_sandbox_response"));

        var result = await harness.Client.Emails.SendOnClusterAsync(
            "4",
            Catalog.Json("email_send_request"),
            idempotencyKey: "idem-1",
            sandbox: true);

        Assert.Equal(HttpMethod.Post, harness.Handler.Method);
        Assert.Equal("https://api.example.test/api/v1/teams/1/clusters/4/sends", harness.Handler.Uri!.ToString());
        Assert.Equal("idem-1", harness.Handler.IdempotencyKey);
        using var sent = JsonDocument.Parse(harness.Handler.Body!);
        Assert.True(sent.RootElement.GetProperty("sandbox").GetBoolean());
        Assert.Equal("hello@mail.example.com", sent.RootElement.GetProperty("from").GetString());
        Assert.False(result.GetProperty("queued").GetBoolean());
    }

    [Fact]
    public async Task Error_403_raises()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.Forbidden, Catalog.Text("error_403"));

        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Client.Emails.SendAsync(Catalog.Json("email_send_request")));

        Assert.Equal("cluster_not_ready", ex.Error);
        Assert.Equal("cluster", ex.Field);
        Assert.Equal("No sending-ready cluster on this team", ex.Message);
    }

    [Fact]
    public async Task Error_422_raises()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json((HttpStatusCode)422, Catalog.Text("error_422"));

        var ex = await Assert.ThrowsAsync<ApiException>(() =>
            harness.Client.Emails.SendAsync(Catalog.Json("email_send_request")));

        Assert.Equal("invalid", ex.Error);
        Assert.Equal("from", ex.Field);
        Assert.Equal("From domain is not verified", ex.Message);
    }

    [Fact]
    public async Task Missing_team_id_raises_on_team_scoped_call()
    {
        using var harness = new Harness(teamId: null);
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Array("cluster"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => harness.Client.Clusters.ListAsync());
        Assert.Equal("teamId is required", ex.Message);
        Assert.Null(harness.Handler.Uri);
    }

    [Fact]
    public async Task Users_me_works_without_team_id()
    {
        using var harness = new Harness(teamId: null);
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("whoami"));

        var me = await harness.Client.Users.MeAsync();
        Assert.Equal("noreply+abc@postshiba.com", me.GetProperty("email").GetString());
    }

    [Fact]
    public async Task Smtp_password_present_on_create_absent_on_delete()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("smtp_credential_create"));
        var created = await harness.Client.SmtpCredentials.CreateAsync("4", Catalog.Json("smtp_credential_create_request"));
        Assert.Equal("once-only-password", created.GetProperty("password").GetString());

        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("smtp_credential_deleted"));
        var deleted = await harness.Client.SmtpCredentials.DeleteAsync("4", "9");
        Assert.False(deleted.TryGetProperty("password", out _));
    }

    [Fact]
    public async Task Webhook_secret_omitted_on_list_present_on_get_and_create()
    {
        using var harness = new Harness();
        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Array("webhook"));
        var list = await harness.Client.Webhooks.ListAsync();
        Assert.False(list[0].TryGetProperty("secret", out _));

        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("webhook_show"));
        var shown = await harness.Client.Webhooks.GetAsync("2");
        Assert.Equal("hex-secret", shown.GetProperty("secret").GetString());

        harness.Handler.Respond = () => MockHandler.Json(HttpStatusCode.OK, Catalog.Text("webhook_show"));
        var created = await harness.Client.Webhooks.CreateAsync(Catalog.Json("webhook_create_request"));
        Assert.Equal("hex-secret", created.GetProperty("secret").GetString());
    }

    [Fact]
    public void Webhooks_verify_accepts_fixture()
    {
        var fixture = Catalog.Json("webhook_verify");
        Assert.True(Webhooks.Verify(
            fixture.GetProperty("secret").GetString()!,
            fixture.GetProperty("timestamp").GetString()!,
            fixture.GetProperty("signature").GetString()!,
            fixture.GetProperty("body").GetString()!));
    }

    [Fact]
    public void Webhooks_verify_rejects_bad_signature()
    {
        var fixture = Catalog.Json("webhook_verify");
        Assert.False(Webhooks.Verify(
            fixture.GetProperty("secret").GetString()!,
            fixture.GetProperty("timestamp").GetString()!,
            "sha256=0000000000000000000000000000000000000000000000000000000000000000",
            fixture.GetProperty("body").GetString()!));
    }

    [Fact]
    public void Webhooks_verify_strips_sha256_prefix()
    {
        var fixture = Catalog.Json("webhook_verify");
        var hex = fixture.GetProperty("signature").GetString()!["sha256=".Length..];
        Assert.True(Webhooks.Verify(
            fixture.GetProperty("secret").GetString()!,
            fixture.GetProperty("timestamp").GetString()!,
            hex,
            fixture.GetProperty("body").GetString()!));
    }

    static void AssertJsonEqual(string expected, string actual)
    {
        using var expectedDoc = JsonDocument.Parse(expected);
        using var actualDoc = JsonDocument.Parse(actual);
        Assert.Equal(
            JsonSerializer.Serialize(expectedDoc.RootElement),
            JsonSerializer.Serialize(actualDoc.RootElement));
    }
}
