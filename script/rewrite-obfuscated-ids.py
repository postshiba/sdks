#!/usr/bin/env python3
"""Rewrite sequential Capsule resource ids to letters-only Hashid fixtures.

Rerun from the repo root. Safe to run more than once.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# CapsuleApi::Catalog::EXAMPLE_IDS. User is not in that table.
USER = "UsErKj"
TEAM = "KjkAJW"
CLUSTER = "NmQpXr"
DOMAIN = "HsVtYk"
TENANT = "WbLcFd"
INBOX = "PqRzMn"
MESSAGE = "GxTyVu"
EVENT = "JkLmNp"
SMTP = "RvWsXq"
SUPPRESSION = "YtReWq"
FIREWALL_ENTRY = "BnMkLo"
WEBHOOK = "CdFgHj"
TEMPLATE = "TpLmQr"
IP_ADDRESS = "IpQwEr"
NODE = "ZxHvTb"
OTHER_CLUSTER = "ZzYyXx"

FILE_ID = {
    "whoami": USER,
    "cluster": CLUSTER,
    "cluster_updated": CLUSTER,
    "cluster_suspended": CLUSTER,
    "cluster_deprovisioned": CLUSTER,
    "sending_domain": DOMAIN,
    "sending_domain_suspended": DOMAIN,
    "sending_domain_primary": DOMAIN,
    "tenant": TENANT,
    "inbox": INBOX,
    "inbox_index": INBOX,
    "message": MESSAGE,
    "message_show": MESSAGE,
    "event": EVENT,
    "smtp_credential_create": SMTP,
    "smtp_credential_deleted": SMTP,
    "suppression": SUPPRESSION,
    "firewall_entry": FIREWALL_ENTRY,
    "webhook": WEBHOOK,
    "webhook_show": WEBHOOK,
    "template": TEMPLATE,
    "template_updated": TEMPLATE,
    "template_duplicated": TEMPLATE,
    "network": IP_ADDRESS,
    "network_assigned": IP_ADDRESS,
    "network_dedicated": IP_ADDRESS,
    "network_released": IP_ADDRESS,
    "cluster_boosted": CLUSTER,
}

FK = {
    "cluster_id": {4: CLUSTER},
    "tenant_id": {12: TENANT},
    "inbox_id": {3: INBOX},
    "sending_domain_id": {8: DOMAIN},
    "node_id": {3: NODE},
}

PATHS = [
    ("/teams/1", f"/teams/{TEAM}"),
    ("/clusters/4", f"/clusters/{CLUSTER}"),
    ("/sending_domains/8", f"/sending_domains/{DOMAIN}"),
    ("/tenants/12", f"/tenants/{TENANT}"),
    ("/inboxes/3", f"/inboxes/{INBOX}"),
    ("/inbound_messages/21", f"/inbound_messages/{MESSAGE}"),
    ("/message_events/44", f"/message_events/{EVENT}"),
    ("/smtp_credentials/9", f"/smtp_credentials/{SMTP}"),
    ("/webhook_endpoints/2", f"/webhook_endpoints/{WEBHOOK}"),
    ("/suppressions/7", f"/suppressions/{SUPPRESSION}"),
    ("/firewall_entries/3", f"/firewall_entries/{FIREWALL_ENTRY}"),
]

TEXT = [
    (f'teamID           = "1"', f'teamID           = "{TEAM}"'),
    (f'teamID           = "{TEAM}"', f'teamID           = "{TEAM}"'),
    ('teamID           = "1"', f'teamID           = "{TEAM}"'),
    ('clusterID        = "4"', f'clusterID        = "{CLUSTER}"'),
    ('sendingDomainID  = "8"', f'sendingDomainID  = "{DOMAIN}"'),
    ('tenantID         = "12"', f'tenantID         = "{TENANT}"'),
    ('inboxID          = "3"', f'inboxID          = "{INBOX}"'),
    ('messageID        = "21"', f'messageID        = "{MESSAGE}"'),
    ('eventID          = "44"', f'eventID          = "{EVENT}"'),
    ('smtpCredentialID = "9"', f'smtpCredentialID = "{SMTP}"'),
    ('suppressionID    = "7"', f'suppressionID    = "{SUPPRESSION}"'),
    ('firewallEntryID  = "3"', f'firewallEntryID  = "{FIREWALL_ENTRY}"'),
    ('webhookID        = "2"', f'webhookID        = "{WEBHOOK}"'),
    ("TEAM = 1", f'TEAM = "{TEAM}"'),
    ("CLUSTER = 4", f'CLUSTER = "{CLUSTER}"'),
    ("SENDING_DOMAIN = 8", f'SENDING_DOMAIN = "{DOMAIN}"'),
    ("TENANT = 12", f'TENANT = "{TENANT}"'),
    ("INBOX = 3", f'INBOX = "{INBOX}"'),
    ("MESSAGE = 21", f'MESSAGE = "{MESSAGE}"'),
    ("EVENT = 44", f'EVENT = "{EVENT}"'),
    ("SMTP = 9", f'SMTP = "{SMTP}"'),
    ("SUPPRESSION = 7", f'SUPPRESSION = "{SUPPRESSION}"'),
    ("FIREWALL_ENTRY = 3", f'FIREWALL_ENTRY = "{FIREWALL_ENTRY}"'),
    ("WEBHOOK = 2", f'WEBHOOK = "{WEBHOOK}"'),
    ("teamId: 1", f'teamId: "{TEAM}"'),
    ("team_id: 1", f'team_id: "{TEAM}"'),
    ("team_id=1", f'team_id="{TEAM}"'),
    ('teamId: "1"', f'teamId: "{TEAM}"'),
    ('team_id: "1"', f'team_id: "{TEAM}"'),
    ('WithTeamID("1")', f'WithTeamID("{TEAM}")'),
    (".team_id(1)", f'.team_id("{TEAM}")'),
    (".teamId(1)", f'.teamId("{TEAM}")'),
    ('teamId = "1"', f'teamId = "{TEAM}"'),
    ("{ teamId: 1 }", f'{{ teamId: "{TEAM}" }}'),
    ("{ teamId: 1,", f'{{ teamId: "{TEAM}",'),
    ("teamId: 1,", f'teamId: "{TEAM}",'),
    ("Object? teamId = 1", f'Object? teamId = "{TEAM}"'),
    ("clusterId: 4", f'clusterId: "{CLUSTER}"'),
    ("cluster_id: 4", f'cluster_id: "{CLUSTER}"'),
    ("cluster_id=4", f'cluster_id="{CLUSTER}"'),
    ('clusterId: "4"', f'clusterId: "{CLUSTER}"'),
    ('cluster_id: "4"', f'cluster_id: "{CLUSTER}"'),
    ("cluster_id: 99", f'cluster_id: "{OTHER_CLUSTER}"'),
    (".clusterId(4)", f'.clusterId("{CLUSTER}")'),
    ('ClusterID: "4"', f'ClusterID: "{CLUSTER}"'),
    ("cluster_id: 4", f'cluster_id: "{CLUSTER}"'),
    ('"cluster_id": 4', f'"cluster_id": "{CLUSTER}"'),
    ("'cluster_id' => 4", f"'cluster_id' => '{CLUSTER}'"),
    ('"cluster_id" => 4', f'"cluster_id" => "{CLUSTER}"'),
    ("send($payload, '4')", f"send($payload, '{CLUSTER}')"),
    ("define('POSTSHIBA_CLUSTER_ID', '4')", f"define('POSTSHIBA_CLUSTER_ID', '{CLUSTER}')"),
    ('GetAsync("4")', f'GetAsync("{CLUSTER}")'),
    ('UpdateAsync("4"', f'UpdateAsync("{CLUSTER}"'),
    ('SuspendAsync("4")', f'SuspendAsync("{CLUSTER}")'),
    ('ResumeAsync("4")', f'ResumeAsync("{CLUSTER}")'),
    ('DeleteAsync("4"', f'DeleteAsync("{CLUSTER}"'),
    ('SendOnClusterAsync("4"', f'SendOnClusterAsync("{CLUSTER}"'),
    ('ListAsync("4")', f'ListAsync("{CLUSTER}")'),
    ('CreateAsync("4"', f'CreateAsync("{CLUSTER}"'),
    ('GetAsync("8")', f'GetAsync("{DOMAIN}")'),
    ('VerifyAsync("8")', f'VerifyAsync("{DOMAIN}")'),
    ('SuspendAsync("8")', f'SuspendAsync("{DOMAIN}")'),
    ('ResumeAsync("8")', f'ResumeAsync("{DOMAIN}")'),
    ('MakePrimaryAsync("8")', f'MakePrimaryAsync("{DOMAIN}")'),
    ('DeleteAsync("8")', f'DeleteAsync("{DOMAIN}")'),
    ('GetAsync("12")', f'GetAsync("{TENANT}")'),
    ('DeleteAsync("12")', f'DeleteAsync("{TENANT}")'),
    ('GetAsync("3")', f'GetAsync("{INBOX}")'),
    ('VerifyAsync("3")', f'VerifyAsync("{INBOX}")'),
    ('DeleteAsync("3")', f'DeleteAsync("{INBOX}")'),
    ('ListAsync("3")', f'ListAsync("{INBOX}")'),
    ('GetAsync("3", "21")', f'GetAsync("{INBOX}", "{MESSAGE}")'),
    ('DownloadAttachmentAsync("3", "21"', f'DownloadAttachmentAsync("{INBOX}", "{MESSAGE}"'),
    ('DeleteAsync("4", "9")', f'DeleteAsync("{CLUSTER}", "{SMTP}")'),
    ('GetAsync("2")', f'GetAsync("{WEBHOOK}")'),
    ('UpdateAsync("2"', f'UpdateAsync("{WEBHOOK}"'),
    ('DeleteAsync("2")', f'DeleteAsync("{WEBHOOK}")'),
    ('DeleteAsync("7")', f'DeleteAsync("{SUPPRESSION}")'),
    ('DeleteEntryAsync("3")', f'DeleteEntryAsync("{FIREWALL_ENTRY}")'),
    ('assertEquals("4"', f'assertEquals("{CLUSTER}"'),
    ('Assert.Equal("4"', f'Assert.Equal("{CLUSTER}"'),
    ('.get(4)', f'.get("{CLUSTER}")'),
    ('.update(4,', f'.update("{CLUSTER}",'),
    ('.suspend(4)', f'.suspend("{CLUSTER}")'),
    ('.resume(4)', f'.resume("{CLUSTER}")'),
    ('.delete(4)', f'.delete("{CLUSTER}")'),
    ('.sendOnCluster(4,', f'.sendOnCluster("{CLUSTER}",'),
    ('.list(4)', f'.list("{CLUSTER}")'),
    ('.create(4,', f'.create("{CLUSTER}",'),
    ('.delete(4, 9)', f'.delete("{CLUSTER}", "{SMTP}")'),
    ('.get(8)', f'.get("{DOMAIN}")'),
    ('.verify(8)', f'.verify("{DOMAIN}")'),
    ('.suspend(8)', f'.suspend("{DOMAIN}")'),
    ('.resume(8)', f'.resume("{DOMAIN}")'),
    ('.makePrimary(8)', f'.makePrimary("{DOMAIN}")'),
    ('.make_primary(8)', f'.make_primary("{DOMAIN}")'),
    ('.delete(8)', f'.delete("{DOMAIN}")'),
    ('.get(12)', f'.get("{TENANT}")'),
    ('.delete(12)', f'.delete("{TENANT}")'),
    ('.get(3)', f'.get("{INBOX}")'),
    ('.verify(3)', f'.verify("{INBOX}")'),
    ('.delete(3)', f'.delete("{INBOX}")'),
    ('.list(3)', f'.list("{INBOX}")'),
    ('.get(3, 21)', f'.get("{INBOX}", "{MESSAGE}")'),
    ('.get(44)', f'.get("{EVENT}")'),
    ('.get(2)', f'.get("{WEBHOOK}")'),
    ('.update(2,', f'.update("{WEBHOOK}",'),
    ('.delete(2)', f'.delete("{WEBHOOK}")'),
    ('.delete(7)', f'.delete("{SUPPRESSION}")'),
    ('.deleteEntry(3)', f'.deleteEntry("{FIREWALL_ENTRY}")'),
    ('.delete_entry(3)', f'.delete_entry("{FIREWALL_ENTRY}")'),
    ("- team `1`", f"- team `{TEAM}`"),
    ("- cluster `4`", f"- cluster `{CLUSTER}`"),
    ("- sending domain `8`", f"- sending domain `{DOMAIN}`"),
    ("- tenant `12`", f"- tenant `{TENANT}`"),
    ("- inbox `3`", f"- inbox `{INBOX}`"),
    ("- inbound message `21`", f"- inbound message `{MESSAGE}`"),
    ("- event `44`", f"- event `{EVENT}`"),
    ("- SMTP credential `9`", f"- SMTP credential `{SMTP}`"),
    ("- suppression `7`", f"- suppression `{SUPPRESSION}`"),
    ("- firewall entry `3`", f"- firewall entry `{FIREWALL_ENTRY}`"),
    ("- webhook `2`", f"- webhook `{WEBHOOK}`"),
    ('== ["4"]', f'== ["{CLUSTER}"]'),
    (', 1)\n    {:ok, bypass: bypass, client: client}', f', "{TEAM}")\n    {{:ok, bypass: bypass, client: client}}'),
    ('teamId(1)', f'teamId("{TEAM}")'),
    ('clusterId(4)', f'clusterId("{CLUSTER}")'),
    ("new PostShiba(\"ps_...\", team_id=1)", f'new PostShiba("ps_...", team_id="{TEAM}")'),
    ('PostShiba("ps_...", team_id=1)', f'PostShiba("ps_...", team_id="{TEAM}")'),
    ('client.emails.send(body, cluster_id=4)', f'client.emails.send(body, cluster_id="{CLUSTER}")'),
    ("?team_id=1", f"?team_id={TEAM}"),
    ("string|int|null $teamId", "string|null $teamId"),
    ("int|string|null $clusterId", "?string $clusterId"),
    ("int|string $clusterId", "string $clusterId"),
    ("int|string $id", "string $id"),
    ("int|string $inboxId", "string $inboxId"),
    ("clusters.get(4)", f'clusters.get("{CLUSTER}")'),
    ("events.list(4)", f'events.list("{CLUSTER}")'),
    ("send_on_cluster(4,", f'send_on_cluster("{CLUSTER}",'),
    ("Emails.send(client, body, cluster_id: 4)", f'Emails.send(client, body, cluster_id: "{CLUSTER}")'),
    ('new Client(apiKey, teamId: "1")', f'new Client(apiKey, teamId: "{TEAM}")'),
    ('SendAsync(body, clusterId: "4")', f'SendAsync(body, clusterId: "{CLUSTER}")'),
    ("PostShiba(\"ps_xxx\", teamId: 1", f'PostShiba("ps_xxx", teamId: "{TEAM}"'),
    ('->get(4)', f'->get("{CLUSTER}")'),
    ('->update(4,', f'->update("{CLUSTER}",'),
    ('->suspend(4)', f'->suspend("{CLUSTER}")'),
    ('->resume(4)', f'->resume("{CLUSTER}")'),
    ('->delete(4)', f'->delete("{CLUSTER}")'),
    ('->sendOnCluster(4,', f'->sendOnCluster("{CLUSTER}",'),
    ('->list(4)', f'->list("{CLUSTER}")'),
    ('->create(4,', f'->create("{CLUSTER}",'),
    ('->delete(4, 9)', f'->delete("{CLUSTER}", "{SMTP}")'),
    ('->get(8)', f'->get("{DOMAIN}")'),
    ('->verify(8)', f'->verify("{DOMAIN}")'),
    ('->suspend(8)', f'->suspend("{DOMAIN}")'),
    ('->resume(8)', f'->resume("{DOMAIN}")'),
    ('->makePrimary(8)', f'->makePrimary("{DOMAIN}")'),
    ('->delete(8)', f'->delete("{DOMAIN}")'),
    ('->get(12)', f'->get("{TENANT}")'),
    ('->delete(12)', f'->delete("{TENANT}")'),
    ('->get(3)', f'->get("{INBOX}")'),
    ('->verify(3)', f'->verify("{INBOX}")'),
    ('->delete(3)', f'->delete("{INBOX}")'),
    ('->list(3)', f'->list("{INBOX}")'),
    ('->get(3, 21)', f'->get("{INBOX}", "{MESSAGE}")'),
    ('->get(44)', f'->get("{EVENT}")'),
    ('->get(2)', f'->get("{WEBHOOK}")'),
    ('->update(2,', f'->update("{WEBHOOK}",'),
    ('->delete(2)', f'->delete("{WEBHOOK}")'),
    ('->delete(7)', f'->delete("{SUPPRESSION}")'),
    ('->deleteEntry(3)', f'->deleteEntry("{FIREWALL_ENTRY}")'),
    ('(&1, 4)', f'(&1, "{CLUSTER}")'),
    ('(&1, 8)', f'(&1, "{DOMAIN}")'),
    ('(&1, 12)', f'(&1, "{TENANT}")'),
    ('(&1, 3)', f'(&1, "{INBOX}")'),
    ('(&1, 44)', f'(&1, "{EVENT}")'),
    ('(&1, 2)', f'(&1, "{WEBHOOK}")'),
    ('(&1, 7)', f'(&1, "{SUPPRESSION}")'),
    ('get(4)?', f'get("{CLUSTER}")?'),
    ("{Object? teamId = 1", f'{{Object? teamId = "{TEAM}"'),
]


def rewrite_value(name: str, key: str | None, value):
    if isinstance(value, dict):
        return {k: rewrite_value(name, k, v) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite_value(name, key, item) for item in value]
    if key == "id" and isinstance(value, int):
        if name == "firewall":
            return FIREWALL_ENTRY
        mapped = FILE_ID.get(name)
        if mapped is None:
            raise SystemExit(f"no id map for fixture {name} id={value}")
        return mapped
    if key in FK and isinstance(value, int):
        return FK[key].get(value, value)
    return value


def rewrite_fixtures() -> None:
    catalog = ROOT / "fixtures" / "catalog"
    for path in sorted(catalog.glob("*.json")):
        data = json.loads(path.read_text())
        rewritten = rewrite_value(path.stem, None, data)
        path.write_text(json.dumps(rewritten, indent=2) + "\n")


def rewrite_text_files() -> None:
    skip_dirs = {".git", "node_modules", "target", "_build", ".pytest_cache", ".phpunit.cache", "vendor"}
    suffixes = {".md", ".json", ".rb", ".ts", ".js", ".py", ".php", ".go", ".java", ".rs", ".cs", ".ex", ".exs", ".dart"}
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix not in suffixes:
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        if path.name == "rewrite-obfuscated-ids.py":
            continue
        text = path.read_text()
        original = text
        for old, new in PATHS + TEXT:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text)


def main() -> None:
    rewrite_fixtures()
    rewrite_text_files()
    print("rewrote fixtures and id literals")


if __name__ == "__main__":
    main()
