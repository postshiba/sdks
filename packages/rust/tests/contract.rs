use postshiba::{webhooks, Client, Error};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;

const TEAM: u64 = 1;
const CLUSTER: u64 = 4;
const SENDING_DOMAIN: u64 = 8;
const TENANT: u64 = 12;
const INBOX: u64 = 3;
const MESSAGE: u64 = 21;
const EVENT: u64 = 44;
const SMTP_CREDENTIAL: u64 = 9;
const SUPPRESSION: u64 = 7;
const FIREWALL_ENTRY: u64 = 3;
const WEBHOOK: u64 = 2;

struct Recorded {
    method: String,
    path: String,
    headers: HashMap<String, String>,
    body: Vec<u8>,
}

impl Recorded {
    fn header(&self, name: &str) -> Option<&str> {
        let needle = name.to_ascii_lowercase();
        self.headers
            .iter()
            .find(|(key, _)| key.to_ascii_lowercase() == needle)
            .map(|(_, value)| value.as_str())
    }

    fn json(&self) -> Value {
        if self.body.is_empty() {
            return Value::Null;
        }
        serde_json::from_slice(&self.body).unwrap()
    }
}

fn catalog_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/catalog")
}

fn fixture(name: &str) -> Value {
    let path = catalog_dir().join(format!("{name}.json"));
    let text = std::fs::read_to_string(&path).unwrap_or_else(|err| {
        panic!("read {}: {err}", path.display());
    });
    serde_json::from_str(&text).unwrap()
}

fn array(name: &str) -> Value {
    json!([fixture(name)])
}

fn serve(status: u16, body: &[u8]) -> (String, mpsc::Receiver<Recorded>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let (tx, rx) = mpsc::channel();
    let body = body.to_vec();
    thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        let recorded = read_request(&mut stream);
        let reason = if status == 200 { "OK" } else { "Error" };
        let header = format!(
            "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
            body.len()
        );
        stream.write_all(header.as_bytes()).unwrap();
        stream.write_all(&body).unwrap();
        let _ = tx.send(recorded);
    });
    (format!("http://{addr}"), rx)
}

fn read_request(stream: &mut std::net::TcpStream) -> Recorded {
    let mut buf = Vec::new();
    let mut tmp = [0u8; 1024];
    loop {
        let n = stream.read(&mut tmp).unwrap();
        if n == 0 {
            break;
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(pos) = find_headers_end(&buf) {
            let header_text = String::from_utf8_lossy(&buf[..pos]);
            let mut lines = header_text.split("\r\n");
            let request_line = lines.next().unwrap();
            let mut parts = request_line.split_whitespace();
            let method = parts.next().unwrap().to_owned();
            let path = parts.next().unwrap().to_owned();
            let mut headers = HashMap::new();
            let mut content_length = 0usize;
            for line in lines {
                if line.is_empty() {
                    continue;
                }
                if let Some((name, value)) = line.split_once(':') {
                    let value = value.trim().to_owned();
                    if name.eq_ignore_ascii_case("content-length") {
                        content_length = value.parse().unwrap_or(0);
                    }
                    headers.insert(name.trim().to_owned(), value);
                }
            }
            let mut body = buf[pos..].to_vec();
            while body.len() < content_length {
                let n = stream.read(&mut tmp).unwrap();
                if n == 0 {
                    break;
                }
                body.extend_from_slice(&tmp[..n]);
            }
            body.truncate(content_length);
            return Recorded {
                method,
                path,
                headers,
                body,
            };
        }
        if n < tmp.len() && buf.windows(4).any(|w| w == b"\r\n\r\n") {
            continue;
        }
    }
    panic!("incomplete HTTP request");
}

fn find_headers_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n").map(|i| i + 4)
}

fn client_on(base_url: &str) -> Client {
    Client::new("test-key").base_url(base_url).team_id(TEAM)
}

fn exchange(
    status: u16,
    response: &Value,
    call: impl FnOnce(&Client) -> Result<Value, Error>,
) -> (Result<Value, Error>, Recorded) {
    let bytes = serde_json::to_vec(response).unwrap();
    let (url, rx) = serve(status, &bytes);
    let result = call(&client_on(&url));
    (result, rx.recv().unwrap())
}

fn ok(response: &Value, call: impl FnOnce(&Client) -> Result<Value, Error>) -> (Value, Recorded) {
    let (result, recorded) = exchange(200, response, call);
    (result.unwrap(), recorded)
}

#[test]
fn bearer_header_and_base_url_override() {
    let (got, recorded) = ok(&fixture("whoami"), |c| c.users().me());
    assert_eq!(got, fixture("whoami"));
    assert_eq!(recorded.method, "GET");
    assert_eq!(recorded.path, "/api/v1/users/me");
    assert_eq!(recorded.header("authorization"), Some("Bearer test-key"));
}

#[test]
fn emails_send_happy_path() {
    let body = fixture("email_send_request");
    let (got, recorded) = ok(&fixture("email_send_response"), |c| c.emails().send(&body));
    assert_eq!(got, fixture("email_send_response"));
    assert_eq!(recorded.method, "POST");
    assert_eq!(recorded.path, "/api/v1/emails");
    assert_eq!(recorded.json(), body);
    assert_eq!(got["queued"], true);
}

#[test]
fn cluster_send_idempotency_and_sandbox() {
    let body = fixture("email_send_request");
    let (got, recorded) = ok(&fixture("email_sandbox_response"), |c| {
        c.emails()
            .send_on_cluster(CLUSTER, &body, Some("idem-123"), true)
    });
    assert_eq!(got, fixture("email_sandbox_response"));
    assert_eq!(got["queued"], false);
    assert_eq!(recorded.method, "POST");
    assert_eq!(
        recorded.path,
        format!("/api/v1/teams/{TEAM}/clusters/{CLUSTER}/sends")
    );
    assert_eq!(recorded.header("idempotency-key"), Some("idem-123"));
    let sent = recorded.json();
    assert_eq!(sent["sandbox"], true);
    assert_eq!(sent["from"], body["from"]);
    assert_eq!(sent["to"], body["to"]);
}

#[test]
fn every_catalog_method() {
    let email = fixture("email_send_request");
    let cluster_create = fixture("cluster_create_request");
    let cluster_update = fixture("cluster_update_request");
    let domain_create = fixture("sending_domain_create_request");
    let tenant_create = fixture("tenant_create_request");
    let inbox_create = fixture("inbox_create_request");
    let smtp_create = fixture("smtp_credential_create_request");
    let webhook_create = fixture("webhook_create_request");
    let suppression_create = fixture("suppression_create_request");
    let firewall_update = fixture("firewall_update_request");
    let firewall_entry = fixture("firewall_entry_create_request");

    let cases: &[(
        &str,
        &str,
        Value,
        Box<dyn Fn(&Client) -> Result<Value, Error>>,
    )] = &[
        (
            "GET",
            "/api/v1/users/me",
            fixture("whoami"),
            Box::new(|c| c.users().me()),
        ),
        (
            "POST",
            "/api/v1/emails",
            fixture("email_send_response"),
            Box::new({
                let email = email.clone();
                move |c| c.emails().send(&email)
            }),
        ),
        (
            "POST",
            "/api/v1/teams/1/clusters/4/sends",
            fixture("email_sandbox_response"),
            Box::new({
                let email = email.clone();
                move |c| c.emails().send_on_cluster(CLUSTER, &email, None, false)
            }),
        ),
        (
            "GET",
            "/api/v1/teams/1/clusters",
            array("cluster"),
            Box::new(|c| c.clusters().list()),
        ),
        (
            "GET",
            "/api/v1/clusters/4",
            fixture("cluster"),
            Box::new(|c| c.clusters().get(CLUSTER)),
        ),
        (
            "POST",
            "/api/v1/teams/1/clusters",
            fixture("cluster"),
            Box::new({
                let cluster_create = cluster_create.clone();
                move |c| c.clusters().create(&cluster_create)
            }),
        ),
        (
            "PATCH",
            "/api/v1/clusters/4",
            fixture("cluster_updated"),
            Box::new({
                let cluster_update = cluster_update.clone();
                move |c| c.clusters().update(CLUSTER, &cluster_update)
            }),
        ),
        (
            "POST",
            "/api/v1/clusters/4/suspend",
            fixture("cluster_suspended"),
            Box::new(|c| c.clusters().suspend(CLUSTER)),
        ),
        (
            "POST",
            "/api/v1/clusters/4/resume",
            fixture("cluster"),
            Box::new(|c| c.clusters().resume(CLUSTER)),
        ),
        (
            "DELETE",
            "/api/v1/clusters/4",
            fixture("cluster_deprovisioned"),
            Box::new(|c| c.clusters().delete(CLUSTER)),
        ),
        (
            "GET",
            "/api/v1/teams/1/sending_domains",
            array("sending_domain"),
            Box::new(|c| c.sending_domains().list()),
        ),
        (
            "GET",
            "/api/v1/sending_domains/8",
            fixture("sending_domain"),
            Box::new(|c| c.sending_domains().get(SENDING_DOMAIN)),
        ),
        (
            "POST",
            "/api/v1/teams/1/sending_domains",
            fixture("sending_domain"),
            Box::new({
                let domain_create = domain_create.clone();
                move |c| c.sending_domains().create(&domain_create)
            }),
        ),
        (
            "POST",
            "/api/v1/sending_domains/8/verify",
            fixture("sending_domain"),
            Box::new(|c| c.sending_domains().verify(SENDING_DOMAIN)),
        ),
        (
            "POST",
            "/api/v1/sending_domains/8/suspend",
            fixture("sending_domain_suspended"),
            Box::new(|c| c.sending_domains().suspend(SENDING_DOMAIN)),
        ),
        (
            "POST",
            "/api/v1/sending_domains/8/resume",
            fixture("sending_domain"),
            Box::new(|c| c.sending_domains().resume(SENDING_DOMAIN)),
        ),
        (
            "POST",
            "/api/v1/sending_domains/8/make_primary",
            fixture("sending_domain_primary"),
            Box::new(|c| c.sending_domains().make_primary(SENDING_DOMAIN)),
        ),
        (
            "DELETE",
            "/api/v1/sending_domains/8",
            fixture("empty"),
            Box::new(|c| c.sending_domains().delete(SENDING_DOMAIN)),
        ),
        (
            "GET",
            "/api/v1/teams/1/tenants",
            array("tenant"),
            Box::new(|c| c.tenants().list()),
        ),
        (
            "GET",
            "/api/v1/tenants/12",
            fixture("tenant"),
            Box::new(|c| c.tenants().get(TENANT)),
        ),
        (
            "POST",
            "/api/v1/teams/1/tenants",
            fixture("tenant"),
            Box::new({
                let tenant_create = tenant_create.clone();
                move |c| c.tenants().create(&tenant_create)
            }),
        ),
        (
            "DELETE",
            "/api/v1/tenants/12",
            fixture("empty"),
            Box::new(|c| c.tenants().delete(TENANT)),
        ),
        (
            "GET",
            "/api/v1/teams/1/inboxes",
            array("inbox_index"),
            Box::new(|c| c.inboxes().list()),
        ),
        (
            "GET",
            "/api/v1/inboxes/3",
            fixture("inbox"),
            Box::new(|c| c.inboxes().get(INBOX)),
        ),
        (
            "POST",
            "/api/v1/teams/1/inboxes",
            fixture("inbox"),
            Box::new({
                let inbox_create = inbox_create.clone();
                move |c| c.inboxes().create(&inbox_create)
            }),
        ),
        (
            "POST",
            "/api/v1/inboxes/3/verify",
            fixture("inbox_index"),
            Box::new(|c| c.inboxes().verify(INBOX)),
        ),
        (
            "DELETE",
            "/api/v1/inboxes/3",
            fixture("inbox_index"),
            Box::new(|c| c.inboxes().delete(INBOX)),
        ),
        (
            "GET",
            "/api/v1/inboxes/3/inbound_messages",
            array("message"),
            Box::new(|c| c.messages().list(INBOX)),
        ),
        (
            "GET",
            "/api/v1/inboxes/3/inbound_messages/21",
            fixture("message_show"),
            Box::new(|c| c.messages().get(INBOX, MESSAGE)),
        ),
        (
            "GET",
            "/api/v1/teams/1/clusters/4/message_events",
            array("event"),
            Box::new(|c| c.events().list(CLUSTER)),
        ),
        (
            "GET",
            "/api/v1/message_events/44",
            fixture("event"),
            Box::new(|c| c.events().get(EVENT)),
        ),
        (
            "POST",
            "/api/v1/teams/1/clusters/4/smtp_credentials",
            fixture("smtp_credential_create"),
            Box::new({
                let smtp_create = smtp_create.clone();
                move |c| c.smtp_credentials().create(CLUSTER, &smtp_create)
            }),
        ),
        (
            "DELETE",
            "/api/v1/teams/1/clusters/4/smtp_credentials/9",
            fixture("smtp_credential_deleted"),
            Box::new(|c| c.smtp_credentials().delete(CLUSTER, SMTP_CREDENTIAL)),
        ),
        (
            "GET",
            "/api/v1/teams/1/webhook_endpoints",
            array("webhook"),
            Box::new(|c| c.webhooks().list()),
        ),
        (
            "GET",
            "/api/v1/webhook_endpoints/2",
            fixture("webhook_show"),
            Box::new(|c| c.webhooks().get(WEBHOOK)),
        ),
        (
            "POST",
            "/api/v1/teams/1/webhook_endpoints",
            fixture("webhook_show"),
            Box::new({
                let webhook_create = webhook_create.clone();
                move |c| c.webhooks().create(&webhook_create)
            }),
        ),
        (
            "GET",
            "/api/v1/teams/1/suppressions",
            array("suppression"),
            Box::new(|c| c.suppressions().list()),
        ),
        (
            "POST",
            "/api/v1/teams/1/suppressions",
            fixture("suppression"),
            Box::new({
                let suppression_create = suppression_create.clone();
                move |c| c.suppressions().create(&suppression_create)
            }),
        ),
        (
            "DELETE",
            "/api/v1/suppressions/7",
            fixture("empty"),
            Box::new(|c| c.suppressions().delete(SUPPRESSION)),
        ),
        (
            "GET",
            "/api/v1/teams/1/firewall",
            fixture("firewall"),
            Box::new(|c| c.firewall().get()),
        ),
        (
            "PATCH",
            "/api/v1/teams/1/firewall",
            fixture("firewall"),
            Box::new({
                let firewall_update = firewall_update.clone();
                move |c| c.firewall().update(&firewall_update)
            }),
        ),
        (
            "POST",
            "/api/v1/teams/1/firewall_entries",
            fixture("firewall_entry"),
            Box::new({
                let firewall_entry = firewall_entry.clone();
                move |c| c.firewall().add_entry(&firewall_entry)
            }),
        ),
        (
            "DELETE",
            "/api/v1/firewall_entries/3",
            fixture("empty"),
            Box::new(|c| c.firewall().delete_entry(FIREWALL_ENTRY)),
        ),
    ];

    for (method, path, response, call) in cases {
        let (got, recorded) = ok(response, |c| call(c));
        assert_eq!(&got, response, "{method} {path} body");
        assert_eq!(recorded.method, *method, "{method} {path} method");
        assert_eq!(recorded.path, *path, "{method} {path} path");
        assert_eq!(
            recorded.header("authorization"),
            Some("Bearer test-key"),
            "{method} {path} auth"
        );
    }

    let (url, rx) = serve(200, b"png-bytes");
    let bytes = client_on(&url)
        .messages()
        .download_attachment(INBOX, MESSAGE, 1)
        .unwrap();
    let recorded = rx.recv().unwrap();
    assert_eq!(bytes, b"png-bytes");
    assert_eq!(recorded.method, "GET");
    assert_eq!(
        recorded.path,
        "/api/v1/inboxes/3/inbound_messages/21/attachments/1"
    );
}

#[test]
fn error_403_and_422_raise() {
    let body_403 = fixture("error_403");
    let (result, _) = exchange(403, &body_403, |c| c.clusters().list());
    let err = result.unwrap_err();
    assert_eq!(err.error.as_deref(), Some("cluster_not_ready"));
    assert_eq!(err.field.as_deref(), Some("cluster"));
    assert_eq!(err.message, "No sending-ready cluster on this team");

    let body_422 = fixture("error_422");
    let email = fixture("email_send_request");
    let (result, _) = exchange(422, &body_422, |c| c.emails().send(&email));
    let err = result.unwrap_err();
    assert_eq!(err.error.as_deref(), Some("invalid"));
    assert_eq!(err.field.as_deref(), Some("from"));
    assert_eq!(err.message, "From domain is not verified");
}

#[test]
fn webhooks_verify_accept_and_reject() {
    let fixture = fixture("webhook_verify");
    let secret = fixture["secret"].as_str().unwrap();
    let timestamp = fixture["timestamp"].as_str().unwrap();
    let body = fixture["body"].as_str().unwrap();
    let signature = fixture["signature"].as_str().unwrap();

    assert!(webhooks::verify(
        secret,
        timestamp,
        body.as_bytes(),
        signature
    ));
    assert!(webhooks::verify(
        secret,
        timestamp,
        body.as_bytes(),
        signature.strip_prefix("sha256=").unwrap()
    ));
    assert!(!webhooks::verify(
        secret,
        timestamp,
        body.as_bytes(),
        "sha256=00"
    ));
    assert!(!webhooks::verify(secret, timestamp, b"tampered", signature));
}

#[test]
fn smtp_password_present_on_create_absent_on_delete() {
    let body = fixture("smtp_credential_create_request");
    let (created, _) = ok(&fixture("smtp_credential_create"), |c| {
        c.smtp_credentials().create(CLUSTER, &body)
    });
    assert_eq!(created["password"], "once-only-password");

    let (deleted, _) = ok(&fixture("smtp_credential_deleted"), |c| {
        c.smtp_credentials().delete(CLUSTER, SMTP_CREDENTIAL)
    });
    assert!(deleted.get("password").is_none());
}

#[test]
fn webhook_secret_omitted_on_list_present_on_get_and_create() {
    let (listed, _) = ok(&array("webhook"), |c| c.webhooks().list());
    assert!(listed[0].get("secret").is_none());

    let (shown, _) = ok(&fixture("webhook_show"), |c| c.webhooks().get(WEBHOOK));
    assert_eq!(shown["secret"], "hex-secret");

    let body = fixture("webhook_create_request");
    let (created, _) = ok(&fixture("webhook_show"), |c| c.webhooks().create(&body));
    assert_eq!(created["secret"], "hex-secret");
}

#[test]
fn missing_team_id_raises() {
    let client = Client::new("test-key");
    let err = client.clusters().list().unwrap_err();
    assert_eq!(err.error.as_deref(), Some("missing_team_id"));
    assert_eq!(err.field.as_deref(), Some("team_id"));
    assert!(!err.message.is_empty());
}
