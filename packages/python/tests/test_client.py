import pytest

from postshiba import Error, PostShiba

from .conftest import client, last_request, load_fixture, request_json, set_bytes, set_json


def test_bearer_header_and_base_url(http):
    set_json(http, load_fixture("whoami"))
    result = client().users.me()
    req = last_request(http)
    assert req.full_url == "https://api.example.test/api/v1/users/me"
    assert req.headers["Authorization"] == "Bearer test-key"
    assert result == load_fixture("whoami")


def test_default_base_url(http):
    set_json(http, load_fixture("whoami"))
    PostShiba("test-key").users.me()
    assert last_request(http).full_url == "https://app.postshiba.com/api/v1/users/me"


def test_emails_send(http):
    body = load_fixture("email_send_request")
    set_json(http, load_fixture("email_send_response"))
    result = client().emails.send(body)
    req = last_request(http)
    assert req.get_method() == "POST"
    assert req.full_url == "https://api.example.test/api/v1/emails"
    assert request_json(req) == body
    assert result == load_fixture("email_send_response")
    assert result["queued"] is True
    assert req.headers.get("X-Capsule-Cluster-Id") is None


def test_emails_send_with_cluster_id(http):
    body = load_fixture("email_send_request")
    set_json(http, load_fixture("email_send_response"))
    result = client().emails.send(body, cluster_id="NmQpXr")
    req = last_request(http)
    assert req.get_method() == "POST"
    assert req.full_url == "https://api.example.test/api/v1/emails"
    assert req.headers["X-Capsule-Cluster-Id"] == "NmQpXr"
    assert request_json(req) == body
    assert result == load_fixture("email_send_response")


def test_send_on_cluster_idempotency_and_sandbox(http):
    body = load_fixture("email_send_request")
    set_json(http, load_fixture("email_sandbox_response"))
    result = client().emails.send_on_cluster("NmQpXr", body, idempotency_key="idem-1", sandbox=True)
    req = last_request(http)
    assert req.get_method() == "POST"
    assert req.full_url == "https://api.example.test/api/v1/teams/KjkAJW/clusters/NmQpXr/sends"
    assert req.headers["Idempotency-Key"] == "idem-1"
    payload = request_json(req)
    assert payload["sandbox"] is True
    assert payload["from"] == body["from"]
    assert "sandbox" not in body
    assert result == load_fixture("email_sandbox_response")
    assert result["queued"] is False


OPERATIONS = [
    ("users.me", lambda c: c.users.me(), "GET", "/api/v1/users/me", None, load_fixture("whoami")),
    (
        "emails.send",
        lambda c: c.emails.send(load_fixture("email_send_request")),
        "POST",
        "/api/v1/emails",
        load_fixture("email_send_request"),
        load_fixture("email_send_response"),
    ),
    (
        "emails.send_on_cluster",
        lambda c: c.emails.send_on_cluster("NmQpXr", load_fixture("email_send_request")),
        "POST",
        "/api/v1/teams/KjkAJW/clusters/NmQpXr/sends",
        load_fixture("email_send_request"),
        load_fixture("email_sandbox_response"),
    ),
    ("clusters.list", lambda c: c.clusters.list(), "GET", "/api/v1/teams/KjkAJW/clusters", None, [load_fixture("cluster")]),
    ("clusters.get", lambda c: c.clusters.get("NmQpXr"), "GET", "/api/v1/clusters/NmQpXr", None, load_fixture("cluster")),
    (
        "clusters.create",
        lambda c: c.clusters.create(load_fixture("cluster_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/clusters",
        load_fixture("cluster_create_request"),
        load_fixture("cluster"),
    ),
    (
        "clusters.update",
        lambda c: c.clusters.update("NmQpXr", load_fixture("cluster_update_request")),
        "PATCH",
        "/api/v1/clusters/NmQpXr",
        load_fixture("cluster_update_request"),
        load_fixture("cluster_updated"),
    ),
    ("clusters.suspend", lambda c: c.clusters.suspend("NmQpXr"), "POST", "/api/v1/clusters/NmQpXr/suspend", None, load_fixture("cluster_suspended")),
    ("clusters.resume", lambda c: c.clusters.resume("NmQpXr"), "POST", "/api/v1/clusters/NmQpXr/resume", None, load_fixture("cluster")),
    ("clusters.delete", lambda c: c.clusters.delete("NmQpXr"), "DELETE", "/api/v1/clusters/NmQpXr", None, load_fixture("cluster_deprovisioned")),
    (
        "sending_domains.list",
        lambda c: c.sending_domains.list(),
        "GET",
        "/api/v1/teams/KjkAJW/sending_domains",
        None,
        [load_fixture("sending_domain")],
    ),
    ("sending_domains.get", lambda c: c.sending_domains.get("HsVtYk"), "GET", "/api/v1/sending_domains/HsVtYk", None, load_fixture("sending_domain")),
    (
        "sending_domains.create",
        lambda c: c.sending_domains.create(load_fixture("sending_domain_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/sending_domains",
        load_fixture("sending_domain_create_request"),
        load_fixture("sending_domain"),
    ),
    ("sending_domains.verify", lambda c: c.sending_domains.verify("HsVtYk"), "POST", "/api/v1/sending_domains/HsVtYk/verify", None, load_fixture("sending_domain")),
    (
        "sending_domains.suspend",
        lambda c: c.sending_domains.suspend("HsVtYk"),
        "POST",
        "/api/v1/sending_domains/HsVtYk/suspend",
        None,
        load_fixture("sending_domain_suspended"),
    ),
    ("sending_domains.resume", lambda c: c.sending_domains.resume("HsVtYk"), "POST", "/api/v1/sending_domains/HsVtYk/resume", None, load_fixture("sending_domain")),
    (
        "sending_domains.make_primary",
        lambda c: c.sending_domains.make_primary("HsVtYk"),
        "POST",
        "/api/v1/sending_domains/HsVtYk/make_primary",
        None,
        load_fixture("sending_domain_primary"),
    ),
    ("sending_domains.delete", lambda c: c.sending_domains.delete("HsVtYk"), "DELETE", "/api/v1/sending_domains/HsVtYk", None, load_fixture("empty")),
    ("tenants.list", lambda c: c.tenants.list(), "GET", "/api/v1/teams/KjkAJW/tenants", None, [load_fixture("tenant")]),
    ("tenants.get", lambda c: c.tenants.get("WbLcFd"), "GET", "/api/v1/tenants/WbLcFd", None, load_fixture("tenant")),
    (
        "tenants.create",
        lambda c: c.tenants.create(load_fixture("tenant_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/tenants",
        load_fixture("tenant_create_request"),
        load_fixture("tenant"),
    ),
    ("tenants.delete", lambda c: c.tenants.delete("WbLcFd"), "DELETE", "/api/v1/tenants/WbLcFd", None, load_fixture("empty")),
    ("inboxes.list", lambda c: c.inboxes.list(), "GET", "/api/v1/teams/KjkAJW/inboxes", None, [load_fixture("inbox_index")]),
    ("inboxes.get", lambda c: c.inboxes.get("PqRzMn"), "GET", "/api/v1/inboxes/PqRzMn", None, load_fixture("inbox")),
    (
        "inboxes.create",
        lambda c: c.inboxes.create(load_fixture("inbox_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/inboxes",
        load_fixture("inbox_create_request"),
        load_fixture("inbox"),
    ),
    ("inboxes.verify", lambda c: c.inboxes.verify("PqRzMn"), "POST", "/api/v1/inboxes/PqRzMn/verify", None, load_fixture("inbox_index")),
    ("inboxes.delete", lambda c: c.inboxes.delete("PqRzMn"), "DELETE", "/api/v1/inboxes/PqRzMn", None, load_fixture("inbox_index")),
    ("messages.list", lambda c: c.messages.list("PqRzMn"), "GET", "/api/v1/inboxes/PqRzMn/inbound_messages", None, [load_fixture("message")]),
    ("messages.get", lambda c: c.messages.get("PqRzMn", "GxTyVu"), "GET", "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu", None, load_fixture("message_show")),
    ("events.list", lambda c: c.events.list("NmQpXr"), "GET", "/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events", None, [load_fixture("event")]),
    ("events.get", lambda c: c.events.get("JkLmNp"), "GET", "/api/v1/message_events/JkLmNp", None, load_fixture("event")),
    (
        "smtp_credentials.create",
        lambda c: c.smtp_credentials.create("NmQpXr", load_fixture("smtp_credential_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials",
        load_fixture("smtp_credential_create_request"),
        load_fixture("smtp_credential_create"),
    ),
    (
        "smtp_credentials.delete",
        lambda c: c.smtp_credentials.delete("NmQpXr", "RvWsXq"),
        "DELETE",
        "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq",
        None,
        load_fixture("smtp_credential_deleted"),
    ),
    ("webhooks.list", lambda c: c.webhooks.list(), "GET", "/api/v1/teams/KjkAJW/webhook_endpoints", None, [load_fixture("webhook")]),
    ("webhooks.get", lambda c: c.webhooks.get("CdFgHj"), "GET", "/api/v1/webhook_endpoints/CdFgHj", None, load_fixture("webhook_show")),
    (
        "webhooks.create",
        lambda c: c.webhooks.create(load_fixture("webhook_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/webhook_endpoints",
        load_fixture("webhook_create_request"),
        load_fixture("webhook_show"),
    ),
    (
        "webhooks.update",
        lambda c: c.webhooks.update("CdFgHj", load_fixture("webhook_update_request")),
        "PATCH",
        "/api/v1/webhook_endpoints/CdFgHj",
        load_fixture("webhook_update_request"),
        load_fixture("webhook"),
    ),
    ("webhooks.delete", lambda c: c.webhooks.delete("CdFgHj"), "DELETE", "/api/v1/webhook_endpoints/CdFgHj", None, load_fixture("empty")),
    ("suppressions.list", lambda c: c.suppressions.list(), "GET", "/api/v1/teams/KjkAJW/suppressions", None, [load_fixture("suppression")]),
    (
        "suppressions.create",
        lambda c: c.suppressions.create(load_fixture("suppression_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/suppressions",
        load_fixture("suppression_create_request"),
        load_fixture("suppression"),
    ),
    ("suppressions.delete", lambda c: c.suppressions.delete("YtReWq"), "DELETE", "/api/v1/suppressions/YtReWq", None, load_fixture("empty")),
    ("firewall.get", lambda c: c.firewall.get(), "GET", "/api/v1/teams/KjkAJW/firewall", None, load_fixture("firewall")),
    (
        "firewall.update",
        lambda c: c.firewall.update(load_fixture("firewall_update_request")),
        "PATCH",
        "/api/v1/teams/KjkAJW/firewall",
        load_fixture("firewall_update_request"),
        load_fixture("firewall"),
    ),
    (
        "firewall.add_entry",
        lambda c: c.firewall.add_entry(load_fixture("firewall_entry_create_request")),
        "POST",
        "/api/v1/teams/KjkAJW/firewall_entries",
        load_fixture("firewall_entry_create_request"),
        load_fixture("firewall_entry"),
    ),
    ("firewall.delete_entry", lambda c: c.firewall.delete_entry("BnMkLo"), "DELETE", "/api/v1/firewall_entries/BnMkLo", None, load_fixture("empty")),
]


@pytest.mark.parametrize("name,call,method,path,request_body,response", OPERATIONS, ids=[row[0] for row in OPERATIONS])
def test_every_operation(http, name, call, method, path, request_body, response):
    set_json(http, response)
    result = call(client())
    req = last_request(http)
    assert req.get_method() == method
    assert req.full_url == "https://api.example.test" + path
    assert request_json(req) == request_body
    assert result == response


def test_download_attachment_path(http):
    set_bytes(http, b"png-bytes")
    result = client().messages.download_attachment("PqRzMn", "GxTyVu", 1)
    req = last_request(http)
    assert req.get_method() == "GET"
    assert req.full_url == "https://api.example.test/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1"
    assert result == b"png-bytes"


@pytest.mark.parametrize(
    "status,fixture",
    [
        (403, "error_403"),
        (422, "error_422"),
    ],
)
def test_error_raises(http, status, fixture):
    payload = load_fixture(fixture)
    set_json(http, payload, status=status)
    with pytest.raises(Error) as exc:
        client().emails.send(load_fixture("email_send_request"))
    assert exc.value.error == payload["error"]
    assert exc.value.field == payload["field"]
    assert exc.value.message == payload["message"]


def test_webhooks_verify_accept_and_reject():
    fixture = load_fixture("webhook_verify")
    client_ = PostShiba("test-key")
    assert client_.webhooks.verify(fixture["body"], fixture["signature"], fixture["timestamp"], fixture["secret"])
    assert not client_.webhooks.verify(fixture["body"], "sha256=00" * 32, fixture["timestamp"], fixture["secret"])
    assert not client_.webhooks.verify("[]", fixture["signature"], fixture["timestamp"], fixture["secret"])


def test_smtp_password_present_on_create_absent_on_delete(http):
    set_json(http, load_fixture("smtp_credential_create"))
    created = client().smtp_credentials.create("NmQpXr", load_fixture("smtp_credential_create_request"))
    assert created["password"] == "once-only-password"
    set_json(http, load_fixture("smtp_credential_deleted"))
    deleted = client().smtp_credentials.delete("NmQpXr", "RvWsXq")
    assert "password" not in deleted


def test_webhook_secret_omitted_on_list_and_update_present_on_get_and_create(http):
    set_json(http, [load_fixture("webhook")])
    listed = client().webhooks.list()
    assert "secret" not in listed[0]
    set_json(http, load_fixture("webhook_show"))
    shown = client().webhooks.get("CdFgHj")
    assert shown["secret"] == "hex-secret"
    set_json(http, load_fixture("webhook_show"))
    created = client().webhooks.create(load_fixture("webhook_create_request"))
    assert created["secret"] == "hex-secret"
    set_json(http, load_fixture("webhook"))
    updated = client().webhooks.update("CdFgHj", load_fixture("webhook_update_request"))
    assert updated == load_fixture("webhook")
    assert "secret" not in updated


def test_missing_team_id_raises(http):
    bare = PostShiba("test-key", base_url="https://api.example.test")
    with pytest.raises(Error) as exc:
        bare.clusters.list()
    assert exc.value.field == "team_id"
    assert http["requests"] == []


def test_import_without_django():
    import sys

    sys.modules.pop("postshiba.django", None)
    import postshiba

    assert hasattr(postshiba, "PostShiba")
    assert "postshiba.django" not in sys.modules
