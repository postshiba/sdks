import io
import json
import os
import urllib.error

import pytest

from postshiba import PostShiba

FIXTURES = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "fixtures", "catalog"))


def load_fixture(name):
    path = os.path.join(FIXTURES, name + ".json")
    with open(path) as fh:
        return json.load(fh)


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.fixture
def http(monkeypatch):
    state = {"requests": [], "status": 200, "body": b"{}", "error_headers": None}

    def fake_urlopen(req, timeout=None):
        state["requests"].append(req)
        if state["status"] >= 400:
            raise urllib.error.HTTPError(
                req.full_url,
                state["status"],
                "error",
                state["error_headers"],
                io.BytesIO(state["body"]),
            )
        return FakeResponse(state["body"])

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    return state


def set_json(http, payload, status=200):
    http["status"] = status
    http["body"] = json.dumps(payload).encode("utf-8")


def set_bytes(http, payload, status=200):
    http["status"] = status
    http["body"] = payload


def client(team_id=1):
    return PostShiba("test-key", base_url="https://api.example.test", team_id=team_id)


def last_request(http):
    return http["requests"][-1]


def request_json(req):
    if req.data is None:
        return None
    return json.loads(req.data.decode("utf-8"))
