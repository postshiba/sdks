package com.postshiba;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;

public final class PostShiba {
    public static final String DEFAULT_BASE_URL = "https://app.postshiba.com";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String baseUrl;
    private final String teamId;
    private final HttpClient httpClient;

    public final Users users = new Users();
    public final Emails emails = new Emails();
    public final Clusters clusters = new Clusters();
    public final SendingDomains sendingDomains = new SendingDomains();
    public final Tenants tenants = new Tenants();
    public final Inboxes inboxes = new Inboxes();
    public final Messages messages = new Messages();
    public final Events events = new Events();
    public final SmtpCredentials smtpCredentials = new SmtpCredentials();
    public final Webhooks webhooks = new Webhooks();
    public final Suppressions suppressions = new Suppressions();
    public final Firewall firewall = new Firewall();

    public PostShiba(String apiKey) {
        this(apiKey, new Options());
    }

    public PostShiba(String apiKey, Options options) {
        this.apiKey = Objects.requireNonNull(apiKey, "apiKey");
        Options opts = options == null ? new Options() : options;
        String url = opts.baseUrl == null || opts.baseUrl.isEmpty() ? DEFAULT_BASE_URL : opts.baseUrl;
        this.baseUrl = trimTrailingSlash(url);
        this.teamId = opts.teamId;
        this.httpClient = opts.httpClient == null
                ? HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build()
                : opts.httpClient;
    }

    public static final class Options {
        String baseUrl;
        String teamId;
        HttpClient httpClient;

        public Options baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        public Options teamId(String teamId) {
            this.teamId = teamId;
            return this;
        }

        public Options httpClient(HttpClient httpClient) {
            this.httpClient = httpClient;
            return this;
        }
    }

    public static final class SendOptions {
        public String clusterId;

        public SendOptions clusterId(String clusterId) {
            this.clusterId = clusterId;
            return this;
        }
    }

    public static final class SendOnClusterOptions {
        public String idempotencyKey;
        public boolean sandbox;

        public SendOnClusterOptions idempotencyKey(String idempotencyKey) {
            this.idempotencyKey = idempotencyKey;
            return this;
        }

        public SendOnClusterOptions sandbox(boolean sandbox) {
            this.sandbox = sandbox;
            return this;
        }
    }

    public final class Users {
        public JsonNode me() {
            return request("GET", "/api/v1/users/me", null, null);
        }
    }

    public final class Emails {
        public JsonNode send(Object body) {
            return send(body, null);
        }

        public JsonNode send(Object body, SendOptions options) {
            Map<String, String> headers = null;
            if (options != null && options.clusterId != null && !options.clusterId.isEmpty()) {
                headers = Map.of("X-Capsule-Cluster-Id", options.clusterId);
            }
            return request("POST", "/api/v1/emails", body, headers);
        }

        public JsonNode sendOnCluster(String clusterId, Object body) {
            return sendOnCluster(clusterId, body, null);
        }

        public JsonNode sendOnCluster(String clusterId, Object body, SendOnClusterOptions options) {
            Object payload = body;
            Map<String, String> headers = null;
            if (options != null) {
                if (options.sandbox) {
                    payload = withSandbox(body);
                }
                if (options.idempotencyKey != null && !options.idempotencyKey.isEmpty()) {
                    headers = Map.of("Idempotency-Key", options.idempotencyKey);
                }
            }
            return request("POST", teamsPath("/clusters/" + id(clusterId) + "/sends"), payload, headers);
        }
    }

    public final class Clusters {
        public JsonNode list() {
            return request("GET", teamsPath("/clusters"), null, null);
        }

        public JsonNode get(String id) {
            return request("GET", "/api/v1/clusters/" + id(id), null, null);
        }

        public JsonNode create(Object body) {
            return request("POST", teamsPath("/clusters"), body, null);
        }

        public JsonNode update(String id, Object body) {
            return request("PATCH", "/api/v1/clusters/" + id(id), body, null);
        }

        public JsonNode suspend(String id) {
            return request("POST", "/api/v1/clusters/" + id(id) + "/suspend", null, null);
        }

        public JsonNode resume(String id) {
            return request("POST", "/api/v1/clusters/" + id(id) + "/resume", null, null);
        }

        public JsonNode delete(String id) {
            return request("DELETE", "/api/v1/clusters/" + id(id), null, null);
        }
    }

    public final class SendingDomains {
        public JsonNode list() {
            return request("GET", teamsPath("/sending_domains"), null, null);
        }

        public JsonNode get(String id) {
            return request("GET", "/api/v1/sending_domains/" + id(id), null, null);
        }

        public JsonNode create(Object body) {
            return request("POST", teamsPath("/sending_domains"), body, null);
        }

        public JsonNode verify(String id) {
            return request("POST", "/api/v1/sending_domains/" + id(id) + "/verify", null, null);
        }

        public JsonNode suspend(String id) {
            return request("POST", "/api/v1/sending_domains/" + id(id) + "/suspend", null, null);
        }

        public JsonNode resume(String id) {
            return request("POST", "/api/v1/sending_domains/" + id(id) + "/resume", null, null);
        }

        public JsonNode makePrimary(String id) {
            return request("POST", "/api/v1/sending_domains/" + id(id) + "/make_primary", null, null);
        }

        public JsonNode delete(String id) {
            return request("DELETE", "/api/v1/sending_domains/" + id(id), null, null);
        }
    }

    public final class Tenants {
        public JsonNode list() {
            return request("GET", teamsPath("/tenants"), null, null);
        }

        public JsonNode get(String id) {
            return request("GET", "/api/v1/tenants/" + id(id), null, null);
        }

        public JsonNode create(Object body) {
            return request("POST", teamsPath("/tenants"), body, null);
        }

        public JsonNode delete(String id) {
            return request("DELETE", "/api/v1/tenants/" + id(id), null, null);
        }
    }

    public final class Inboxes {
        public JsonNode list() {
            return request("GET", teamsPath("/inboxes"), null, null);
        }

        public JsonNode get(String id) {
            return request("GET", "/api/v1/inboxes/" + id(id), null, null);
        }

        public JsonNode create(Object body) {
            return request("POST", teamsPath("/inboxes"), body, null);
        }

        public JsonNode verify(String id) {
            return request("POST", "/api/v1/inboxes/" + id(id) + "/verify", null, null);
        }

        public JsonNode delete(String id) {
            return request("DELETE", "/api/v1/inboxes/" + id(id), null, null);
        }
    }

    public final class Messages {
        public JsonNode list(String inboxId) {
            return request("GET", "/api/v1/inboxes/" + id(inboxId) + "/inbound_messages", null, null);
        }

        public JsonNode get(String inboxId, String id) {
            return request("GET", "/api/v1/inboxes/" + id(inboxId) + "/inbound_messages/" + id(id), null, null);
        }

        public byte[] downloadAttachment(String inboxId, String id, int index) {
            return requestRaw(
                    "GET",
                    "/api/v1/inboxes/" + id(inboxId) + "/inbound_messages/" + id(id) + "/attachments/" + index,
                    null,
                    null
            );
        }
    }

    public final class Events {
        public JsonNode list(String clusterId) {
            return request("GET", teamsPath("/clusters/" + id(clusterId) + "/message_events"), null, null);
        }

        public JsonNode get(String id) {
            return request("GET", "/api/v1/message_events/" + id(id), null, null);
        }
    }

    public final class SmtpCredentials {
        public JsonNode create(String clusterId, Object body) {
            return request("POST", teamsPath("/clusters/" + id(clusterId) + "/smtp_credentials"), body, null);
        }

        public JsonNode delete(String clusterId, String id) {
            return request("DELETE", teamsPath("/clusters/" + id(clusterId) + "/smtp_credentials/" + id(id)), null, null);
        }
    }

    public final class Webhooks {
        public JsonNode list() {
            return request("GET", teamsPath("/webhook_endpoints"), null, null);
        }

        public JsonNode get(String id) {
            return request("GET", "/api/v1/webhook_endpoints/" + id(id), null, null);
        }

        public JsonNode create(Object body) {
            return request("POST", teamsPath("/webhook_endpoints"), body, null);
        }

        public JsonNode update(String id, Object body) {
            return request("PATCH", "/api/v1/webhook_endpoints/" + id(id), body, null);
        }

        public JsonNode delete(String id) {
            return request("DELETE", "/api/v1/webhook_endpoints/" + id(id), null, null);
        }

        public boolean verify(String secret, String timestamp, String rawBody, String signature) {
            String provided = signature == null ? "" : signature;
            if (provided.startsWith("sha256=")) {
                provided = provided.substring("sha256=".length());
            }
            byte[] expected = hmacSha256(secret, timestamp + "." + rawBody);
            byte[] given;
            try {
                given = HexFormat.of().parseHex(provided);
            } catch (IllegalArgumentException e) {
                return false;
            }
            return MessageDigest.isEqual(expected, given);
        }
    }

    public final class Suppressions {
        public JsonNode list() {
            return request("GET", teamsPath("/suppressions"), null, null);
        }

        public JsonNode create(Object body) {
            return request("POST", teamsPath("/suppressions"), body, null);
        }

        public JsonNode delete(String id) {
            return request("DELETE", "/api/v1/suppressions/" + id(id), null, null);
        }
    }

    public final class Firewall {
        public JsonNode get() {
            return request("GET", teamsPath("/firewall"), null, null);
        }

        public JsonNode update(Object body) {
            return request("PATCH", teamsPath("/firewall"), body, null);
        }

        public JsonNode addEntry(Object body) {
            return request("POST", teamsPath("/firewall_entries"), body, null);
        }

        public JsonNode deleteEntry(String id) {
            return request("DELETE", "/api/v1/firewall_entries/" + id(id), null, null);
        }
    }

    private String teamsPath(String suffix) {
        if (teamId == null || teamId.isEmpty()) {
            throw new IllegalStateException("team id is required");
        }
        return "/api/v1/teams/" + teamId + suffix;
    }

    private JsonNode request(String method, String path, Object body, Map<String, String> headers) {
        byte[] raw = requestRaw(method, path, body, headers);
        if (raw.length == 0) {
            return MAPPER.createObjectNode();
        }
        try {
            return MAPPER.readTree(raw);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private byte[] requestRaw(String method, String path, Object body, Map<String, String> headers) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + apiKey);
        if (body != null) {
            builder.header("Content-Type", "application/json");
            builder.method(method, HttpRequest.BodyPublishers.ofString(toJson(body), StandardCharsets.UTF_8));
        } else if ("GET".equals(method)) {
            builder.GET();
        } else if ("DELETE".equals(method)) {
            builder.DELETE();
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }
        if (headers != null) {
            headers.forEach(builder::header);
        }
        HttpResponse<byte[]> response;
        try {
            response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
        byte[] raw = response.body() == null ? new byte[0] : response.body();
        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            throw parseError(raw);
        }
        return raw;
    }

    private static ApiError parseError(byte[] raw) {
        try {
            JsonNode node = MAPPER.readTree(raw);
            return new ApiError(text(node, "error"), text(node, "field"), text(node, "message"));
        } catch (Exception e) {
            return new ApiError("http_error", null, new String(raw, StandardCharsets.UTF_8));
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String toJson(Object body) {
        try {
            return MAPPER.writeValueAsString(body);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Object withSandbox(Object body) {
        JsonNode node = MAPPER.valueToTree(body);
        if (node instanceof ObjectNode objectNode) {
            ObjectNode copy = objectNode.deepCopy();
            copy.put("sandbox", true);
            return copy;
        }
        throw new IllegalArgumentException("sendOnCluster body must be a JSON object");
    }

    private static byte[] hmacSha256(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String id(String value) {
        return value;
    }

    private static String trimTrailingSlash(String url) {
        if (url.endsWith("/")) {
            return url.substring(0, url.length() - 1);
        }
        return url;
    }
}
