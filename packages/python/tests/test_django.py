import base64

import pytest

django = pytest.importorskip("django")
from django.conf import settings
from django.core.mail import EmailMultiAlternatives

if not settings.configured:
    settings.configure(
        POSTSHIBA_API_KEY="test-key",
        POSTSHIBA_BASE_URL="https://api.example.test",
    )
    django.setup()

from postshiba.django import EmailBackend, email_payload


def test_django_maps_to_from_subject_html_text_attachments():
    captured = {}

    class FakeEmails:
        def send(self, body):
            captured.update(body)
            return {"queued": True}

    class FakeClient:
        emails = FakeEmails()

    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    message = EmailMultiAlternatives(
        subject="PostShiba test",
        body="hello from PostShiba",
        from_email="hello@mail.example.com",
        to=["you@example.com"],
    )
    message.attach_alternative("<p>hello from PostShiba</p>", "text/html")
    message.attach("photo.png", png, "image/png")

    payload = email_payload(message)
    assert payload["to"] == ["you@example.com"]
    assert payload["from"] == "hello@mail.example.com"
    assert payload["subject"] == "PostShiba test"
    assert payload["html"] == "<p>hello from PostShiba</p>"
    assert payload["text"] == "hello from PostShiba"
    assert payload["attachments"][0]["filename"] == "photo.png"
    assert payload["attachments"][0]["content_type"] == "image/png"
    assert payload["attachments"][0]["content"] == base64.b64encode(png).decode("ascii")

    sent = EmailBackend(client=FakeClient()).send_messages([message])
    assert sent == 1
    assert captured["to"] == payload["to"]
    assert captured["from"] == payload["from"]
    assert captured["subject"] == payload["subject"]
    assert captured["html"] == payload["html"]
    assert captured["text"] == payload["text"]
    assert captured["attachments"] == payload["attachments"]
