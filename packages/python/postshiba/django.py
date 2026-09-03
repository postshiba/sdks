import base64

from django.core.mail.backends.base import BaseEmailBackend

from .client import PostShiba


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
    reply_to = None
    if getattr(message, "reply_to", None):
        reply_to = message.reply_to[0]
    return {
        "from": message.from_email,
        "to": list(message.to or []),
        "cc": list(message.cc or []),
        "bcc": list(message.bcc or []),
        "reply_to": reply_to,
        "subject": message.subject,
        "text": text,
        "html": html,
        "attachments": _attachments(message),
        "headers": dict(getattr(message, "extra_headers", None) or {}),
    }


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
