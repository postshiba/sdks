import base64
import json

from django.core.mail.backends.base import BaseEmailBackend

from .client import PostShiba

DROP_HEADERS = {
    "bcc",
    "cc",
    "connection",
    "content-length",
    "content-transfer-encoding",
    "content-type",
    "date",
    "feedback-id",
    "from",
    "host",
    "keep-alive",
    "mime-version",
    "proxy-authenticate",
    "proxy-authorization",
    "received",
    "reply-to",
    "return-path",
    "sender",
    "subject",
    "te",
    "to",
    "trailer",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "x-capsule-cluster-id",
    "x-capsule-unique-args",
    "x-complaints-to",
    "x-mailer",
    "x-report-abuse",
}

UNIQUE_ARGS_HEADER = "x-capsule-unique-args"


def email_payload(message):
    html = None
    text = message.body
    if getattr(message, "content_subtype", "plain") == "html":
        html = message.body
        text = None
    for content, mimetype in getattr(message, "alternatives", []) or []:
        if mimetype == "text/html":
            html = content
            break
    extra = dict(getattr(message, "extra_headers", None) or {})
    unique_args = _unique_args(extra)
    headers = {
        name: value
        for name, value in extra.items()
        if str(name).lower() not in DROP_HEADERS and value not in (None, "")
    }
    out = {
        "from": message.from_email,
        "to": list(message.to or []),
        "subject": message.subject,
        "text": text,
        "html": html,
        "attachments": _attachments(message),
    }
    cc = list(message.cc or [])
    if cc:
        out["cc"] = cc
    bcc = list(message.bcc or [])
    if bcc:
        out["bcc"] = bcc
    if getattr(message, "reply_to", None):
        out["reply_to"] = message.reply_to[0]
    if headers:
        out["headers"] = headers
    if unique_args:
        out["unique_args"] = unique_args
    return out


def _unique_args(extra):
    raw = None
    for name, value in extra.items():
        if str(name).lower() == UNIQUE_ARGS_HEADER:
            raw = value
            break
    if not raw:
        return None
    try:
        decoded = json.loads(raw)
    except (TypeError, ValueError):
        return None
    return decoded if isinstance(decoded, dict) else None


def _attachments(message):
    out = []
    for item in getattr(message, "attachments", None) or []:
        if not isinstance(item, tuple):
            continue
        filename, content, mimetype = item
        if isinstance(content, str):
            content = content.encode("utf-8")
        out.append(
            {
                "filename": filename,
                "content_type": mimetype or "application/octet-stream",
                "content": base64.b64encode(content).decode("ascii"),
            }
        )
    return out


class EmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, client=None, **kwargs):
        super().__init__(**kwargs)
        self.fail_silently = fail_silently
        if client is not None:
            self.client = client
            return
        from django.conf import settings

        self.client = PostShiba(
            api_key=getattr(settings, "POSTSHIBA_API_KEY", ""),
            base_url=getattr(settings, "POSTSHIBA_BASE_URL", None),
            team_id=getattr(settings, "POSTSHIBA_TEAM_ID", None),
        )

    def send_messages(self, email_messages):
        sent = 0
        for message in email_messages:
            try:
                self.client.emails.send(email_payload(message))
            except Exception:
                if not self.fail_silently:
                    raise
            else:
                sent += 1
        return sent
