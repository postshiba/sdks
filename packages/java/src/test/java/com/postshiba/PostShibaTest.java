package com.postshiba;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PostShibaTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Path CATALOG = Path.of("../../fixtures/catalog");

    private MockApi api;
    private PostShiba client;

    @BeforeEach
    void start() throws IOException {
        api = new MockApi();
        client = new PostShiba(
                "test-key",
                new PostShiba.Options().baseUrl(api.url()).teamId(1).httpClient(HttpClient.newHttpClient())
        );
    }

    @AfterEach
    void stop() {
        api.close();
    }

    @Test
    void defaultBaseUrl() throws Exception {
        var field = PostShiba.class.getDeclaredField("baseUrl");
        field.setAccessible(true);
        assertEquals("https://app.postshiba.com", field.get(new PostShiba("key")));
    }

    @Test
    void bearerAndBaseUrlOverride() {
        api.respond(200, fixture("whoami"));
        JsonNode me = client.users.me();
        assertEquals("GET", api.last.method);
        assertEquals("/api/v1/users/me", api.last.path);
        assertEquals("Bearer test-key", api.last.header("Authorization"));
        assertEquals(api.url(), "http://127.0.0.1:" + api.port);
        assertEquals("Production", me.get("first_name").asText());
    }

    @Test
    void emailsSend() {
        api.respond(200, fixture("email_send_response"));
        JsonNode sent = client.emails.send(fixtureMap("email_send_request"));
        assertEquals("POST", api.last.method);
        assertEquals("/api/v1/emails", api.last.path);
        assertEquals(fixtureJson("email_send_request"), api.last.bodyJson());
        assertEquals(fixtureJson("email_send_response"), sent);
        assertTrue(sent.get("queued").asBoolean());
    }

    @Test
    void sendOnClusterIdempotencyAndSandbox() {
        api.respond(200, fixture("email_sandbox_response"));
        JsonNode sent = client.emails.sendOnCluster(
                4,
                fixtureMap("email_send_request"),
                new PostShiba.SendOnClusterOptions().idempotencyKey("idem-1").sandbox(true)
        );
        assertEquals("POST", api.last.method);
        assertEquals("/api/v1/teams/1/clusters/4/sends", api.last.path);
        assertEquals("idem-1", api.last.header("Idempotency-Key"));
        JsonNode body = api.last.bodyJson();
        assertTrue(body.get("sandbox").asBoolean());
        assertEquals("hello@mail.example.com", body.get("from").asText());
        assertEquals(fixtureJson("email_sandbox_response"), sent);
        assertFalse(sent.get("queued").asBoolean());
    }

    @Test
    void everyOperation() {
        record Op(String method, String path, String response, boolean array, String request, ThrowingConsumer<PostShiba> call) {}
        List<Op> ops = List.of(
                new Op("GET", "/api/v1/users/me", "whoami", false, null, c -> c.users.me()),
                new Op("POST", "/api/v1/emails", "email_send_response", false, "email_send_request",
                        c -> c.emails.send(fixtureMap("email_send_request"))),
                new Op("POST", "/api/v1/teams/1/clusters/4/sends", "email_sandbox_response", false, null,
                        c -> c.emails.sendOnCluster(4, fixtureMap("email_send_request"))),
                new Op("GET", "/api/v1/teams/1/clusters", "cluster", true, null, c -> c.clusters.list()),
                new Op("GET", "/api/v1/clusters/4", "cluster", false, null, c -> c.clusters.get(4)),
                new Op("POST", "/api/v1/teams/1/clusters", "cluster", false, "cluster_create_request",
                        c -> c.clusters.create(fixtureMap("cluster_create_request"))),
                new Op("PATCH", "/api/v1/clusters/4", "cluster_updated", false, "cluster_update_request",
                        c -> c.clusters.update(4, fixtureMap("cluster_update_request"))),
                new Op("POST", "/api/v1/clusters/4/suspend", "cluster_suspended", false, null, c -> c.clusters.suspend(4)),
                new Op("POST", "/api/v1/clusters/4/resume", "cluster", false, null, c -> c.clusters.resume(4)),
                new Op("DELETE", "/api/v1/clusters/4", "cluster_deprovisioned", false, null, c -> c.clusters.delete(4)),
                new Op("GET", "/api/v1/teams/1/sending_domains", "sending_domain", true, null, c -> c.sendingDomains.list()),
                new Op("GET", "/api/v1/sending_domains/8", "sending_domain", false, null, c -> c.sendingDomains.get(8)),
                new Op("POST", "/api/v1/teams/1/sending_domains", "sending_domain", false, "sending_domain_create_request",
                        c -> c.sendingDomains.create(fixtureMap("sending_domain_create_request"))),
                new Op("POST", "/api/v1/sending_domains/8/verify", "sending_domain", false, null, c -> c.sendingDomains.verify(8)),
                new Op("POST", "/api/v1/sending_domains/8/suspend", "sending_domain_suspended", false, null,
                        c -> c.sendingDomains.suspend(8)),
                new Op("POST", "/api/v1/sending_domains/8/resume", "sending_domain", false, null, c -> c.sendingDomains.resume(8)),
                new Op("POST", "/api/v1/sending_domains/8/make_primary", "sending_domain_primary", false, null,
                        c -> c.sendingDomains.makePrimary(8)),
                new Op("DELETE", "/api/v1/sending_domains/8", "empty", false, null, c -> c.sendingDomains.delete(8)),
                new Op("GET", "/api/v1/teams/1/tenants", "tenant", true, null, c -> c.tenants.list()),
                new Op("GET", "/api/v1/tenants/12", "tenant", false, null, c -> c.tenants.get(12)),
                new Op("POST", "/api/v1/teams/1/tenants", "tenant", false, "tenant_create_request",
                        c -> c.tenants.create(fixtureMap("tenant_create_request"))),
                new Op("DELETE", "/api/v1/tenants/12", "empty", false, null, c -> c.tenants.delete(12)),
                new Op("GET", "/api/v1/teams/1/inboxes", "inbox_index", true, null, c -> c.inboxes.list()),
                new Op("GET", "/api/v1/inboxes/3", "inbox", false, null, c -> c.inboxes.get(3)),
                new Op("POST", "/api/v1/teams/1/inboxes", "inbox", false, "inbox_create_request",
                        c -> c.inboxes.create(fixtureMap("inbox_create_request"))),
                new Op("POST", "/api/v1/inboxes/3/verify", "inbox_index", false, null, c -> c.inboxes.verify(3)),
                new Op("DELETE", "/api/v1/inboxes/3", "inbox_index", false, null, c -> c.inboxes.delete(3)),
                new Op("GET", "/api/v1/inboxes/3/inbound_messages", "message", true, null, c -> c.messages.list(3)),
                new Op("GET", "/api/v1/inboxes/3/inbound_messages/21", "message_show", false, null, c -> c.messages.get(3, 21)),
                new Op("GET", "/api/v1/teams/1/clusters/4/message_events", "event", true, null, c -> c.events.list(4)),
                new Op("GET", "/api/v1/message_events/44", "event", false, null, c -> c.events.get(44)),
                new Op("POST", "/api/v1/teams/1/clusters/4/smtp_credentials", "smtp_credential_create", false,
                        "smtp_credential_create_request",
                        c -> c.smtpCredentials.create(4, fixtureMap("smtp_credential_create_request"))),
                new Op("DELETE", "/api/v1/teams/1/clusters/4/smtp_credentials/9", "smtp_credential_deleted", false, null,
                        c -> c.smtpCredentials.delete(4, 9)),
                new Op("GET", "/api/v1/teams/1/webhook_endpoints", "webhook", true, null, c -> c.webhooks.list()),
                new Op("GET", "/api/v1/webhook_endpoints/2", "webhook_show", false, null, c -> c.webhooks.get(2)),
                new Op("POST", "/api/v1/teams/1/webhook_endpoints", "webhook_show", false, "webhook_create_request",
                        c -> c.webhooks.create(fixtureMap("webhook_create_request"))),
                new Op("GET", "/api/v1/teams/1/suppressions", "suppression", true, null, c -> c.suppressions.list()),
                new Op("POST", "/api/v1/teams/1/suppressions", "suppression", false, "suppression_create_request",
                        c -> c.suppressions.create(fixtureMap("suppression_create_request"))),
                new Op("DELETE", "/api/v1/suppressions/7", "empty", false, null, c -> c.suppressions.delete(7)),
                new Op("GET", "/api/v1/teams/1/firewall", "firewall", false, null, c -> c.firewall.get()),
                new Op("PATCH", "/api/v1/teams/1/firewall", "firewall", false, "firewall_update_request",
                        c -> c.firewall.update(fixtureMap("firewall_update_request"))),
                new Op("POST", "/api/v1/teams/1/firewall_entries", "firewall_entry", false, "firewall_entry_create_request",
                        c -> c.firewall.addEntry(fixtureMap("firewall_entry_create_request"))),
                new Op("DELETE", "/api/v1/firewall_entries/3", "empty", false, null, c -> c.firewall.deleteEntry(3))
        );

        List<String> names = new ArrayList<>();
        for (Op op : ops) {
            names.add(op.method + " " + op.path);
            JsonNode expected = op.array ? arrayOf(op.response) : fixtureJson(op.response);
            api.respond(200, expected.toString());
            JsonNode actual = op.call.accept(client);
            assertEquals(op.method, api.last.method, op.path);
            assertEquals(op.path, api.last.path);
            assertEquals("Bearer test-key", api.last.header("Authorization"));
            assertEquals(expected, actual, op.path);
            if (op.request != null) {
                assertEquals(fixtureJson(op.request), api.last.bodyJson(), op.path);
            }
        }
        assertEquals(43, names.size());
    }

    @Test
    void downloadAttachmentPath() {
        api.respondBytes(200, "PNG".getBytes(StandardCharsets.UTF_8), "image/png");
        byte[] bytes = client.messages.downloadAttachment(3, 21, 1);
        assertEquals("GET", api.last.method);
        assertEquals("/api/v1/inboxes/3/inbound_messages/21/attachments/1", api.last.path);
        assertArrayEquals("PNG".getBytes(StandardCharsets.UTF_8), bytes);
    }

    @Test
    void error403() {
        api.respond(403, fixture("error_403"));
        ApiError error = assertThrows(ApiError.class, () -> client.clusters.list());
        JsonNode expected = fixtureJson("error_403");
        assertEquals(expected.get("error").asText(), error.error);
        assertEquals(expected.get("field").asText(), error.field);
        assertEquals(expected.get("message").asText(), error.message);
    }

    @Test
    void error422() {
        api.respond(422, fixture("error_422"));
        ApiError error = assertThrows(ApiError.class, () -> client.emails.send(fixtureMap("email_send_request")));
        JsonNode expected = fixtureJson("error_422");
        assertEquals(expected.get("error").asText(), error.error);
        assertEquals(expected.get("field").asText(), error.field);
        assertEquals(expected.get("message").asText(), error.message);
    }

    @Test
    void webhookVerifyAcceptAndReject() {
        JsonNode fixture = fixtureJson("webhook_verify");
        String secret = fixture.get("secret").asText();
        String timestamp = fixture.get("timestamp").asText();
        String body = fixture.get("body").asText();
        String signature = fixture.get("signature").asText();
        assertTrue(client.webhooks.verify(secret, timestamp, body, signature));
        assertTrue(client.webhooks.verify(secret, timestamp, body, signature.substring("sha256=".length())));
        assertFalse(client.webhooks.verify(secret, timestamp, body, "sha256=00"));
        assertFalse(client.webhooks.verify(secret, timestamp, "[{\"event\":\"dropped\"}]", signature));
    }

    @Test
    void smtpPasswordOnCreateOnly() {
        api.respond(200, fixture("smtp_credential_create"));
        JsonNode created = client.smtpCredentials.create(4, fixtureMap("smtp_credential_create_request"));
        assertEquals("once-only-password", created.get("password").asText());

        api.respond(200, fixture("smtp_credential_deleted"));
        JsonNode deleted = client.smtpCredentials.delete(4, 9);
        assertFalse(deleted.has("password"));
        assertEquals("smtp_9", deleted.get("username").asText());
    }

    @Test
    void webhookSecretOnGetAndCreateOnly() {
        api.respond(200, arrayOf("webhook").toString());
        JsonNode listed = client.webhooks.list();
        assertFalse(listed.get(0).has("secret"));

        api.respond(200, fixture("webhook_show"));
        JsonNode shown = client.webhooks.get(2);
        assertEquals("hex-secret", shown.get("secret").asText());

        api.respond(200, fixture("webhook_show"));
        JsonNode created = client.webhooks.create(fixtureMap("webhook_create_request"));
        assertEquals("hex-secret", created.get("secret").asText());
    }

    @Test
    void missingTeamId() {
        PostShiba bare = new PostShiba("test-key", new PostShiba.Options().baseUrl(api.url()));
        IllegalStateException error = assertThrows(IllegalStateException.class, bare.clusters::list);
        assertEquals("team id is required", error.getMessage());
    }

    @Test
    void apiErrorIsRuntimeException() {
        assertInstanceOf(RuntimeException.class, new ApiError("invalid", "from", "nope"));
        assertNull(new ApiError("x", null, null).field);
    }

    private static String fixture(String name) {
        try {
            return Files.readString(CATALOG.resolve(name + ".json"));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static JsonNode fixtureJson(String name) {
        try {
            return MAPPER.readTree(fixture(name));
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> fixtureMap(String name) {
        try {
            return MAPPER.readValue(fixture(name), Map.class);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static JsonNode arrayOf(String name) {
        return MAPPER.createArrayNode().add(fixtureJson(name));
    }

    @FunctionalInterface
    private interface ThrowingConsumer<T> {
        JsonNode accept(T value);
    }

    private static final class Recorded {
        final String method;
        final String path;
        final Map<String, List<String>> headers;
        final String body;

        Recorded(HttpExchange exchange) throws IOException {
            this.method = exchange.getRequestMethod();
            this.path = exchange.getRequestURI().getPath();
            this.headers = exchange.getRequestHeaders();
            try (InputStream in = exchange.getRequestBody()) {
                this.body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        }

        String header(String name) {
            List<String> values = headers.get(name);
            return values == null || values.isEmpty() ? null : values.get(0);
        }

        JsonNode bodyJson() {
            try {
                return MAPPER.readTree(body);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }
    }

    private static final class MockApi implements AutoCloseable {
        final HttpServer server;
        final int port;
        volatile Recorded last;
        volatile int status = 200;
        volatile byte[] response = "{}".getBytes(StandardCharsets.UTF_8);
        volatile String contentType = "application/json";

        MockApi() throws IOException {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", this::handle);
            server.start();
            port = server.getAddress().getPort();
        }

        String url() {
            return "http://127.0.0.1:" + port;
        }

        void respond(int status, String body) {
            this.status = status;
            this.response = body.getBytes(StandardCharsets.UTF_8);
            this.contentType = "application/json";
        }

        void respondBytes(int status, byte[] body, String contentType) {
            this.status = status;
            this.response = body;
            this.contentType = contentType;
        }

        private void handle(HttpExchange exchange) throws IOException {
            last = new Recorded(exchange);
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(status, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
