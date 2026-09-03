import hashlib
import hmac
import json
import urllib.error
import urllib.request


class Error(Exception):
    def __init__(self, error=None, field=None, message=None):
        self.error = error
        self.field = field
        self.message = message
        super().__init__(message or error or "request failed")


class PostShiba:
    def __init__(self, api_key, base_url=None, team_id=None):
        self.api_key = api_key
        self.base_url = (base_url or "https://postshiba.com").rstrip("/")
        self.team_id = team_id
        self.users = _Users(self)
        self.emails = _Emails(self)
        self.clusters = _Clusters(self)
        self.sending_domains = _SendingDomains(self)
        self.tenants = _Tenants(self)
        self.inboxes = _Inboxes(self)
        self.messages = _Messages(self)
        self.events = _Events(self)
        self.smtp_credentials = _SmtpCredentials(self)
        self.webhooks = _Webhooks(self)
        self.suppressions = _Suppressions(self)
        self.firewall = _Firewall(self)

    def _require_team_id(self):
        if self.team_id is None:
            raise Error(error="missing_team_id", field="team_id", message="team_id is required")
        return self.team_id

    def request(self, method, path, body=None, headers=None, binary=False):
        url = self.base_url + path
        data = None if body is None else json.dumps(body).encode("utf-8")
        req_headers = {
            "Authorization": "Bearer %s" % self.api_key,
            "Accept": "application/json",
        }
        if data is not None:
            req_headers["Content-Type"] = "application/json"
        if headers:
            req_headers.update(headers)
        req = urllib.request.Request(url, data=data, method=method)
        req.headers.update(req_headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            raw = exc.read()
            payload = {}
            if raw:
                try:
                    payload = json.loads(raw.decode("utf-8"))
                except ValueError:
                    payload = {"message": raw.decode("utf-8", errors="replace")}
            raise Error(
                error=payload.get("error"),
                field=payload.get("field"),
                message=payload.get("message"),
            ) from exc
        if binary:
            return raw
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))


class _Users:
    def __init__(self, client):
        self._client = client

    def me(self):
        return self._client.request("GET", "/api/v1/users/me")


class _Emails:
    def __init__(self, client):
        self._client = client

    def send(self, body):
        return self._client.request("POST", "/api/v1/emails", body=body)

    def send_on_cluster(self, cluster_id, body, idempotency_key=None, sandbox=False):
        payload = dict(body)
        if sandbox:
            payload["sandbox"] = True
        headers = {}
        if idempotency_key is not None:
            headers["Idempotency-Key"] = idempotency_key
        path = "/api/v1/teams/%s/clusters/%s/sends" % (self._client._require_team_id(), cluster_id)
        return self._client.request("POST", path, body=payload, headers=headers or None)


class _Clusters:
    def __init__(self, client):
        self._client = client

    def list(self):
        return self._client.request("GET", "/api/v1/teams/%s/clusters" % self._client._require_team_id())

    def get(self, id):
        return self._client.request("GET", "/api/v1/clusters/%s" % id)

    def create(self, body):
        return self._client.request(
            "POST", "/api/v1/teams/%s/clusters" % self._client._require_team_id(), body=body
        )

    def update(self, id, body):
        return self._client.request("PATCH", "/api/v1/clusters/%s" % id, body=body)

    def suspend(self, id):
        return self._client.request("POST", "/api/v1/clusters/%s/suspend" % id)

    def resume(self, id):
        return self._client.request("POST", "/api/v1/clusters/%s/resume" % id)

    def delete(self, id):
        return self._client.request("DELETE", "/api/v1/clusters/%s" % id)


class _SendingDomains:
    def __init__(self, client):
        self._client = client

    def list(self):
        return self._client.request(
            "GET", "/api/v1/teams/%s/sending_domains" % self._client._require_team_id()
        )

    def get(self, id):
        return self._client.request("GET", "/api/v1/sending_domains/%s" % id)

    def create(self, body):
        return self._client.request(
            "POST",
            "/api/v1/teams/%s/sending_domains" % self._client._require_team_id(),
            body=body,
        )

    def verify(self, id):
        return self._client.request("POST", "/api/v1/sending_domains/%s/verify" % id)

    def suspend(self, id):
        return self._client.request("POST", "/api/v1/sending_domains/%s/suspend" % id)

    def resume(self, id):
        return self._client.request("POST", "/api/v1/sending_domains/%s/resume" % id)

    def make_primary(self, id):
        return self._client.request("POST", "/api/v1/sending_domains/%s/make_primary" % id)

    def delete(self, id):
        return self._client.request("DELETE", "/api/v1/sending_domains/%s" % id)


class _Tenants:
    def __init__(self, client):
        self._client = client

    def list(self):
        return self._client.request("GET", "/api/v1/teams/%s/tenants" % self._client._require_team_id())

    def get(self, id):
        return self._client.request("GET", "/api/v1/tenants/%s" % id)

    def create(self, body):
        return self._client.request(
            "POST", "/api/v1/teams/%s/tenants" % self._client._require_team_id(), body=body
        )

    def delete(self, id):
        return self._client.request("DELETE", "/api/v1/tenants/%s" % id)


class _Inboxes:
    def __init__(self, client):
        self._client = client

    def list(self):
        return self._client.request("GET", "/api/v1/teams/%s/inboxes" % self._client._require_team_id())

    def get(self, id):
        return self._client.request("GET", "/api/v1/inboxes/%s" % id)

    def create(self, body):
        return self._client.request(
            "POST", "/api/v1/teams/%s/inboxes" % self._client._require_team_id(), body=body
        )

    def verify(self, id):
        return self._client.request("POST", "/api/v1/inboxes/%s/verify" % id)

    def delete(self, id):
        return self._client.request("DELETE", "/api/v1/inboxes/%s" % id)


class _Messages:
    def __init__(self, client):
        self._client = client

    def list(self, inbox_id):
        return self._client.request("GET", "/api/v1/inboxes/%s/inbound_messages" % inbox_id)

    def get(self, inbox_id, id):
        return self._client.request("GET", "/api/v1/inboxes/%s/inbound_messages/%s" % (inbox_id, id))

    def download_attachment(self, inbox_id, id, index):
        path = "/api/v1/inboxes/%s/inbound_messages/%s/attachments/%s" % (inbox_id, id, index)
        return self._client.request("GET", path, binary=True)


class _Events:
    def __init__(self, client):
        self._client = client

    def list(self, cluster_id):
        path = "/api/v1/teams/%s/clusters/%s/message_events" % (
            self._client._require_team_id(),
            cluster_id,
        )
        return self._client.request("GET", path)

    def get(self, id):
        return self._client.request("GET", "/api/v1/message_events/%s" % id)


class _SmtpCredentials:
    def __init__(self, client):
        self._client = client

    def create(self, cluster_id, body):
        path = "/api/v1/teams/%s/clusters/%s/smtp_credentials" % (
            self._client._require_team_id(),
            cluster_id,
        )
        return self._client.request("POST", path, body=body)

    def delete(self, cluster_id, id):
        path = "/api/v1/teams/%s/clusters/%s/smtp_credentials/%s" % (
            self._client._require_team_id(),
            cluster_id,
            id,
        )
        return self._client.request("DELETE", path)


class _Webhooks:
    def __init__(self, client):
        self._client = client

    def list(self):
        return self._client.request(
            "GET", "/api/v1/teams/%s/webhook_endpoints" % self._client._require_team_id()
        )

    def get(self, id):
        return self._client.request("GET", "/api/v1/webhook_endpoints/%s" % id)

    def create(self, body):
        return self._client.request(
            "POST",
            "/api/v1/teams/%s/webhook_endpoints" % self._client._require_team_id(),
            body=body,
        )

    def verify(self, raw_body, signature, timestamp, secret):
        if signature is None or timestamp is None or secret is None:
            return False
        provided = signature
        if isinstance(provided, bytes):
            provided = provided.decode("utf-8")
        if provided.startswith("sha256="):
            provided = provided[7:]
        if isinstance(raw_body, bytes):
            raw_body = raw_body.decode("utf-8")
        key = secret.encode("utf-8") if isinstance(secret, str) else secret
        digest = hmac.new(key, ("%s.%s" % (timestamp, raw_body)).encode("utf-8"), hashlib.sha256).hexdigest()
        if len(provided) != len(digest):
            return False
        return hmac.compare_digest(digest, provided)


class _Suppressions:
    def __init__(self, client):
        self._client = client

    def list(self):
        return self._client.request(
            "GET", "/api/v1/teams/%s/suppressions" % self._client._require_team_id()
        )

    def create(self, body):
        return self._client.request(
            "POST", "/api/v1/teams/%s/suppressions" % self._client._require_team_id(), body=body
        )

    def delete(self, id):
        return self._client.request("DELETE", "/api/v1/suppressions/%s" % id)


class _Firewall:
    def __init__(self, client):
        self._client = client

    def get(self):
        return self._client.request("GET", "/api/v1/teams/%s/firewall" % self._client._require_team_id())

    def update(self, body):
        return self._client.request(
            "PATCH", "/api/v1/teams/%s/firewall" % self._client._require_team_id(), body=body
        )

    def add_entry(self, body):
        return self._client.request(
            "POST",
            "/api/v1/teams/%s/firewall_entries" % self._client._require_team_id(),
            body=body,
        )

    def delete_entry(self, id):
        return self._client.request("DELETE", "/api/v1/firewall_entries/%s" % id)
