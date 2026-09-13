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
                new PostShiba.Options().baseUrl(api.url()).teamId("KjkAJW").httpClient(HttpClient.newHttpClient())
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
        assertNull(api.last.header("X-Capsule-Cluster-Id"));
    }

    @Test
    void emailsSendTemplate() {
        api.respond(200, fixture("email_send_template_response"));
        JsonNode sent = client.emails.send(fixtureMap("email_send_template_request"));
        assertEquals("POST", api.last.method);
        assertEquals("/api/v1/emails", api.last.path);
        assertEquals(fixtureJson("email_send_template_request"), api.last.bodyJson());
        assertEquals(fixtureJson("email_send_template_response"), sent);
    }

    @Test
    void emailsSendPinsCluster() {
        api.respond(200, fixture("email_send_response"));
        JsonNode sent = client.emails.send(
                fixtureMap("email_send_request"),
                new PostShiba.SendOptions().clusterId("NmQpXr")
        );
        assertEquals("POST", api.last.method);
        assertEquals("/api/v1/emails", api.last.path);
        assertEquals("NmQpXr", api.last.header("X-Capsule-Cluster-Id"));
        assertEquals(fixtureJson("email_send_response"), sent);
    }

    @Test
    void sendOnClusterIdempotencyAndSandbox() {
        api.respond(200, fixture("email_sandbox_response"));
        JsonNode sent = client.emails.sendOnCluster(
                "NmQpXr",
                fixtureMap("email_send_request"),
                new PostShiba.SendOnClusterOptions().idempotencyKey("idem-1").sandbox(true)
        );
        assertEquals("POST", api.last.method);
        assertEquals("/api/v1/teams/KjkAJW/clusters/NmQpXr/sends", api.last.path);
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
                new Op("POST", "/api/v1/teams/KjkAJW/clusters/NmQpXr/sends", "email_sandbox_response", false, null,
                        c -> c.emails.sendOnCluster("NmQpXr", fixtureMap("email_send_request"))),
                new Op("GET", "/api/v1/teams/KjkAJW/clusters", "cluster", true, null, c -> c.clusters.list()),
                new Op("GET", "/api/v1/clusters/NmQpXr", "cluster", false, null, c -> c.clusters.get("NmQpXr")),
                new Op("POST", "/api/v1/teams/KjkAJW/clusters", "cluster", false, "cluster_create_request",
                        c -> c.clusters.create(fixtureMap("cluster_create_request"))),
                new Op("PATCH", "/api/v1/clusters/NmQpXr", "cluster_updated", false, "cluster_update_request",
                        c -> c.clusters.update("NmQpXr", fixtureMap("cluster_update_request"))),
                new Op("POST", "/api/v1/clusters/NmQpXr/suspend", "cluster_suspended", false, null, c -> c.clusters.suspend("NmQpXr")),
                new Op("POST", "/api/v1/clusters/NmQpXr/resume", "cluster", false, null, c -> c.clusters.resume("NmQpXr")),
                new Op("DELETE", "/api/v1/clusters/NmQpXr", "cluster_deprovisioned", false, null, c -> c.clusters.delete("NmQpXr")),
                new Op("POST", "/api/v1/clusters/NmQpXr/boost", "cluster_boosted", false, "cluster_boost_request",
                        c -> c.clusters.boost("NmQpXr", fixtureMap("cluster_boost_request"))),
                new Op("POST", "/api/v1/clusters/NmQpXr/extend_boost", "cluster_boosted", false, "cluster_extend_boost_request",
                        c -> c.clusters.extendBoost("NmQpXr", fixtureMap("cluster_extend_boost_request"))),
                new Op("POST", "/api/v1/clusters/NmQpXr/cancel_boost", "cluster", false, null, c -> c.clusters.cancelBoost("NmQpXr")),
                new Op("GET", "/api/v1/teams/KjkAJW/network", "network", true, null, c -> c.network.list()),
                new Op("POST", "/api/v1/teams/KjkAJW/network", "network_assigned", false, "network_create_request",
                        c -> c.network.create(fixtureMap("network_create_request"))),
                new Op("POST", "/api/v1/teams/KjkAJW/network/assign", "network_dedicated", false, "network_create_request",
                        c -> c.network.assign(fixtureMap("network_create_request"))),
                new Op("POST", "/api/v1/teams/KjkAJW/network/unassign", "network", false, "network_create_request",
                        c -> c.network.unassign(fixtureMap("network_create_request"))),
                new Op("POST", "/api/v1/teams/KjkAJW/network/switch", "network_assigned", false, "network_create_request",
                        c -> c.network.switch_(fixtureMap("network_create_request"))),
                new Op("POST", "/api/v1/teams/KjkAJW/network/release", "network_released", false, "network_release_request",
                        c -> c.network.release(fixtureMap("network_release_request"))),
                new Op("GET", "/api/v1/teams/KjkAJW/sending_domains", "sending_domain", true, null, c -> c.sendingDomains.list()),
                new Op("GET", "/api/v1/sending_domains/HsVtYk", "sending_domain", false, null, c -> c.sendingDomains.get("HsVtYk")),
                new Op("POST", "/api/v1/teams/KjkAJW/sending_domains", "sending_domain", false, "sending_domain_create_request",
                        c -> c.sendingDomains.create(fixtureMap("sending_domain_create_request"))),
                new Op("PATCH", "/api/v1/sending_domains/HsVtYk", "sending_domain_updated", false, "sending_domain_update_request",
                        c -> c.sendingDomains.update("HsVtYk", fixtureMap("sending_domain_update_request"))),
                new Op("POST", "/api/v1/sending_domains/HsVtYk/refresh", "sending_domain", false, null, c -> c.sendingDomains.refresh("HsVtYk")),
                new Op("POST", "/api/v1/sending_domains/HsVtYk/verify", "sending_domain", false, null, c -> c.sendingDomains.verify("HsVtYk")),
                new Op("POST", "/api/v1/sending_domains/HsVtYk/suspend", "sending_domain_suspended", false, null,
                        c -> c.sendingDomains.suspend("HsVtYk")),
                new Op("POST", "/api/v1/sending_domains/HsVtYk/resume", "sending_domain", false, null, c -> c.sendingDomains.resume("HsVtYk")),
                new Op("POST", "/api/v1/sending_domains/HsVtYk/make_primary", "sending_domain_primary", false, null,
                        c -> c.sendingDomains.makePrimary("HsVtYk")),
                new Op("DELETE", "/api/v1/sending_domains/HsVtYk", "empty", false, null, c -> c.sendingDomains.delete("HsVtYk")),
                new Op("GET", "/api/v1/teams/KjkAJW/tenants", "tenant", true, null, c -> c.tenants.list()),
                new Op("GET", "/api/v1/tenants/WbLcFd", "tenant", false, null, c -> c.tenants.get("WbLcFd")),
                new Op("POST", "/api/v1/teams/KjkAJW/tenants", "tenant", false, "tenant_create_request",
                        c -> c.tenants.create(fixtureMap("tenant_create_request"))),
                new Op("DELETE", "/api/v1/tenants/WbLcFd", "empty", false, null, c -> c.tenants.delete("WbLcFd")),
                new Op("GET", "/api/v1/teams/KjkAJW/inboxes", "inbox_index", true, null, c -> c.inboxes.list()),
                new Op("GET", "/api/v1/inboxes/PqRzMn", "inbox", false, null, c -> c.inboxes.get("PqRzMn")),
                new Op("POST", "/api/v1/teams/KjkAJW/inboxes", "inbox", false, "inbox_create_request",
                        c -> c.inboxes.create(fixtureMap("inbox_create_request"))),
                new Op("POST", "/api/v1/inboxes/PqRzMn/verify", "inbox_index", false, null, c -> c.inboxes.verify("PqRzMn")),
                new Op("DELETE", "/api/v1/inboxes/PqRzMn", "inbox_index", false, null, c -> c.inboxes.delete("PqRzMn")),
                new Op("GET", "/api/v1/inboxes/PqRzMn/inbound_messages", "message", true, null, c -> c.messages.list("PqRzMn")),
                new Op("GET", "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu", "message_show", false, null, c -> c.messages.get("PqRzMn", "GxTyVu")),
                new Op("GET", "/api/v1/teams/KjkAJW/message_events", "event", true, null, c -> c.events.listTeam()),
                new Op("GET", "/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events", "event", true, null, c -> c.events.list("NmQpXr")),
                new Op("GET", "/api/v1/message_events/JkLmNp", "event", false, null, c -> c.events.get("JkLmNp")),
                new Op("POST", "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials", "smtp_credential_create", false,
                        "smtp_credential_create_request",
                        c -> c.smtpCredentials.create("NmQpXr", fixtureMap("smtp_credential_create_request"))),
                new Op("DELETE", "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq", "smtp_credential_deleted", false, null,
                        c -> c.smtpCredentials.delete("NmQpXr", "RvWsXq")),
                new Op("GET", "/api/v1/teams/KjkAJW/webhook_endpoints", "webhook", true, null, c -> c.webhooks.list()),
                new Op("GET", "/api/v1/webhook_endpoints/CdFgHj", "webhook_show", false, null, c -> c.webhooks.get("CdFgHj")),
                new Op("POST", "/api/v1/teams/KjkAJW/webhook_endpoints", "webhook_show", false, "webhook_create_request",
                        c -> c.webhooks.create(fixtureMap("webhook_create_request"))),
                new Op("PATCH", "/api/v1/webhook_endpoints/CdFgHj", "webhook", false, "webhook_update_request",
                        c -> c.webhooks.update("CdFgHj", fixtureMap("webhook_update_request"))),
                new Op("DELETE", "/api/v1/webhook_endpoints/CdFgHj", "empty", false, null, c -> c.webhooks.delete("CdFgHj")),
                new Op("GET", "/api/v1/teams/KjkAJW/templates", "template", true, null, c -> c.templates.list()),
                new Op("GET", "/api/v1/templates/TpLmQr", "template", false, null, c -> c.templates.get("TpLmQr")),
                new Op("POST", "/api/v1/teams/KjkAJW/templates", "template", false, "template_create_request",
                        c -> c.templates.create(fixtureMap("template_create_request"))),
                new Op("PATCH", "/api/v1/templates/TpLmQr", "template_updated", false, "template_update_request",
                        c -> c.templates.update("TpLmQr", fixtureMap("template_update_request"))),
                new Op("POST", "/api/v1/templates/TpLmQr/publish", "template", false, null, c -> c.templates.publish("TpLmQr")),
                new Op("POST", "/api/v1/templates/TpLmQr/duplicate", "template_duplicated", false, null, c -> c.templates.duplicate("TpLmQr")),
                new Op("DELETE", "/api/v1/templates/TpLmQr", "empty", false, null, c -> c.templates.delete("TpLmQr")),
                new Op("GET", "/api/v1/teams/KjkAJW/suppressions", "suppression", true, null, c -> c.suppressions.list()),
                new Op("POST", "/api/v1/teams/KjkAJW/suppressions", "suppression", false, "suppression_create_request",
                        c -> c.suppressions.create(fixtureMap("suppression_create_request"))),
                new Op("POST", "/api/v1/teams/KjkAJW/suppressions/import", "suppression_import", false, "suppression_import_request",
                        c -> c.suppressions.import_(fixtureMap("suppression_import_request"))),
                new Op("DELETE", "/api/v1/suppressions/YtReWq", "empty", false, null, c -> c.suppressions.delete("YtReWq")),
                new Op("GET", "/api/v1/teams/KjkAJW/firewall", "firewall", false, null, c -> c.firewall.get()),
                new Op("PATCH", "/api/v1/teams/KjkAJW/firewall", "firewall", false, "firewall_update_request",
                        c -> c.firewall.update(fixtureMap("firewall_update_request"))),
                new Op("POST", "/api/v1/teams/KjkAJW/firewall_entries", "firewall_entry", false, "firewall_entry_create_request",
                        c -> c.firewall.addEntry(fixtureMap("firewall_entry_create_request"))),
                new Op("DELETE", "/api/v1/firewall_entries/BnMkLo", "empty", false, null, c -> c.firewall.deleteEntry("BnMkLo"))
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
        assertEquals(65, names.size());
    }

    @Test
    void downloadAttachmentPath() {
        api.respondBytes(200, "PNG".getBytes(StandardCharsets.UTF_8), "image/png");
        byte[] bytes = client.messages.downloadAttachment("PqRzMn", "GxTyVu", 1);
        assertEquals("GET", api.last.method);
        assertEquals("/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1", api.last.path);
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
        JsonNode created = client.smtpCredentials.create("NmQpXr", fixtureMap("smtp_credential_create_request"));
        assertEquals("once-only-password", created.get("password").asText());

        api.respond(200, fixture("smtp_credential_deleted"));
        JsonNode deleted = client.smtpCredentials.delete("NmQpXr", "RvWsXq");
        assertFalse(deleted.has("password"));
        assertEquals("smtp_9", deleted.get("username").asText());
    }

    @Test
    void webhookSecretOnGetAndCreateOnly() {
        api.respond(200, arrayOf("webhook").toString());
        JsonNode listed = client.webhooks.list();
        assertFalse(listed.get(0).has("secret"));

        api.respond(200, fixture("webhook_show"));
        JsonNode shown = client.webhooks.get("CdFgHj");
        assertEquals("hex-secret", shown.get("secret").asText());

        api.respond(200, fixture("webhook_show"));
        JsonNode created = client.webhooks.create(fixtureMap("webhook_create_request"));
        assertEquals("hex-secret", created.get("secret").asText());

        api.respond(200, fixture("webhook"));
        JsonNode updated = client.webhooks.update("CdFgHj", fixtureMap("webhook_update_request"));
        assertEquals(fixtureJson("webhook"), updated);
        assertFalse(updated.has("secret"));
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
