import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:postshiba/postshiba.dart';
import 'package:test/test.dart';

final catalog = Directory('../../fixtures/catalog');

dynamic fixture(String name) {
  return jsonDecode(File('${catalog.path}/$name.json').readAsStringSync());
}

Map<String, dynamic> fixtureMap(String name) {
  return Map<String, dynamic>.from(fixture(name) as Map);
}

typedef Invoke = Future<dynamic> Function(PostShiba client);

class Call {
  const Call(
    this.name,
    this.method,
    this.path,
    this.invoke, {
    this.body,
    this.response,
    this.list = false,
  });

  final String name;
  final String method;
  final String path;
  final Invoke invoke;
  final String? body;
  final String? response;
  final bool list;
}

final operations = <Call>[
  Call('users.me', 'GET', '/api/v1/users/me', (c) => c.users.me(),
      response: 'whoami'),
  Call(
    'emails.send',
    'POST',
    '/api/v1/emails',
    (c) => c.emails.send(fixtureMap('email_send_request')),
    body: 'email_send_request',
    response: 'email_send_response',
  ),
  Call('clusters.list', 'GET', '/api/v1/teams/KjkAJW/clusters', (c) => c.clusters.list(),
      response: 'cluster', list: true),
  Call('clusters.get', 'GET', '/api/v1/clusters/NmQpXr', (c) => c.clusters.get("NmQpXr"),
      response: 'cluster'),
  Call(
    'clusters.create',
    'POST',
    '/api/v1/teams/KjkAJW/clusters',
    (c) => c.clusters.create(fixtureMap('cluster_create_request')),
    body: 'cluster_create_request',
    response: 'cluster',
  ),
  Call(
    'clusters.update',
    'PATCH',
    '/api/v1/clusters/NmQpXr',
    (c) => c.clusters.update("NmQpXr", fixtureMap('cluster_update_request')),
    body: 'cluster_update_request',
    response: 'cluster_updated',
  ),
  Call('clusters.suspend', 'POST', '/api/v1/clusters/NmQpXr/suspend',
      (c) => c.clusters.suspend("NmQpXr"),
      response: 'cluster_suspended'),
  Call('clusters.resume', 'POST', '/api/v1/clusters/NmQpXr/resume',
      (c) => c.clusters.resume("NmQpXr"),
      response: 'cluster'),
  Call('clusters.delete', 'DELETE', '/api/v1/clusters/NmQpXr', (c) => c.clusters.delete("NmQpXr"),
      response: 'cluster_deprovisioned'),
  Call(
    'sendingDomains.list',
    'GET',
    '/api/v1/teams/KjkAJW/sending_domains',
    (c) => c.sendingDomains.list(),
    response: 'sending_domain',
    list: true,
  ),
  Call('sendingDomains.get', 'GET', '/api/v1/sending_domains/HsVtYk',
      (c) => c.sendingDomains.get("HsVtYk"),
      response: 'sending_domain'),
  Call(
    'sendingDomains.create',
    'POST',
    '/api/v1/teams/KjkAJW/sending_domains',
    (c) => c.sendingDomains.create(fixtureMap('sending_domain_create_request')),
    body: 'sending_domain_create_request',
    response: 'sending_domain',
  ),
  Call('sendingDomains.verify', 'POST', '/api/v1/sending_domains/HsVtYk/verify',
      (c) => c.sendingDomains.verify("HsVtYk"),
      response: 'sending_domain'),
  Call('sendingDomains.suspend', 'POST', '/api/v1/sending_domains/HsVtYk/suspend',
      (c) => c.sendingDomains.suspend("HsVtYk"),
      response: 'sending_domain_suspended'),
  Call('sendingDomains.resume', 'POST', '/api/v1/sending_domains/HsVtYk/resume',
      (c) => c.sendingDomains.resume("HsVtYk"),
      response: 'sending_domain'),
  Call('sendingDomains.makePrimary', 'POST',
      '/api/v1/sending_domains/HsVtYk/make_primary',
      (c) => c.sendingDomains.makePrimary("HsVtYk"),
      response: 'sending_domain_primary'),
  Call('sendingDomains.delete', 'DELETE', '/api/v1/sending_domains/HsVtYk',
      (c) => c.sendingDomains.delete("HsVtYk"),
      response: 'empty'),
  Call('tenants.list', 'GET', '/api/v1/teams/KjkAJW/tenants', (c) => c.tenants.list(),
      response: 'tenant', list: true),
  Call('tenants.get', 'GET', '/api/v1/tenants/WbLcFd', (c) => c.tenants.get("WbLcFd"),
      response: 'tenant'),
  Call(
    'tenants.create',
    'POST',
    '/api/v1/teams/KjkAJW/tenants',
    (c) => c.tenants.create(fixtureMap('tenant_create_request')),
    body: 'tenant_create_request',
    response: 'tenant',
  ),
  Call('tenants.delete', 'DELETE', '/api/v1/tenants/WbLcFd', (c) => c.tenants.delete("WbLcFd"),
      response: 'empty'),
  Call('inboxes.list', 'GET', '/api/v1/teams/KjkAJW/inboxes', (c) => c.inboxes.list(),
      response: 'inbox_index', list: true),
  Call('inboxes.get', 'GET', '/api/v1/inboxes/PqRzMn', (c) => c.inboxes.get("PqRzMn"),
      response: 'inbox'),
  Call(
    'inboxes.create',
    'POST',
    '/api/v1/teams/KjkAJW/inboxes',
    (c) => c.inboxes.create(fixtureMap('inbox_create_request')),
    body: 'inbox_create_request',
    response: 'inbox',
  ),
  Call('inboxes.verify', 'POST', '/api/v1/inboxes/PqRzMn/verify',
      (c) => c.inboxes.verify("PqRzMn"),
      response: 'inbox_index'),
  Call('inboxes.delete', 'DELETE', '/api/v1/inboxes/PqRzMn', (c) => c.inboxes.delete("PqRzMn"),
      response: 'inbox_index'),
  Call('messages.list', 'GET', '/api/v1/inboxes/PqRzMn/inbound_messages',
      (c) => c.messages.list("PqRzMn"),
      response: 'message', list: true),
  Call('messages.get', 'GET', '/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu',
      (c) => c.messages.get("PqRzMn", "GxTyVu"),
      response: 'message_show'),
  Call(
    'events.list',
    'GET',
    '/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events',
    (c) => c.events.list("NmQpXr"),
    response: 'event',
    list: true,
  ),
  Call('events.get', 'GET', '/api/v1/message_events/JkLmNp', (c) => c.events.get("JkLmNp"),
      response: 'event'),
  Call(
    'smtpCredentials.create',
    'POST',
    '/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials',
    (c) => c.smtpCredentials.create("NmQpXr", fixtureMap('smtp_credential_create_request')),
    body: 'smtp_credential_create_request',
    response: 'smtp_credential_create',
  ),
  Call(
    'smtpCredentials.delete',
    'DELETE',
    '/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq',
    (c) => c.smtpCredentials.delete("NmQpXr", "RvWsXq"),
    response: 'smtp_credential_deleted',
  ),
  Call(
    'webhooks.list',
    'GET',
    '/api/v1/teams/KjkAJW/webhook_endpoints',
    (c) => c.webhooks.list(),
    response: 'webhook',
    list: true,
  ),
  Call('webhooks.get', 'GET', '/api/v1/webhook_endpoints/CdFgHj',
      (c) => c.webhooks.get("CdFgHj"),
      response: 'webhook_show'),
  Call(
    'webhooks.create',
    'POST',
    '/api/v1/teams/KjkAJW/webhook_endpoints',
    (c) => c.webhooks.create(fixtureMap('webhook_create_request')),
    body: 'webhook_create_request',
    response: 'webhook_show',
  ),
  Call(
    'webhooks.update',
    'PATCH',
    '/api/v1/webhook_endpoints/CdFgHj',
    (c) => c.webhooks.update("CdFgHj", fixtureMap('webhook_update_request')),
    body: 'webhook_update_request',
    response: 'webhook',
  ),
  Call('webhooks.delete', 'DELETE', '/api/v1/webhook_endpoints/CdFgHj',
      (c) => c.webhooks.delete("CdFgHj"),
      response: 'empty'),
  Call(
    'suppressions.list',
    'GET',
    '/api/v1/teams/KjkAJW/suppressions',
    (c) => c.suppressions.list(),
    response: 'suppression',
    list: true,
  ),
  Call(
    'suppressions.create',
    'POST',
    '/api/v1/teams/KjkAJW/suppressions',
    (c) => c.suppressions.create(fixtureMap('suppression_create_request')),
    body: 'suppression_create_request',
    response: 'suppression',
  ),
  Call('suppressions.delete', 'DELETE', '/api/v1/suppressions/YtReWq',
      (c) => c.suppressions.delete("YtReWq"),
      response: 'empty'),
  Call('firewall.get', 'GET', '/api/v1/teams/KjkAJW/firewall', (c) => c.firewall.get(),
      response: 'firewall'),
  Call(
    'firewall.update',
    'PATCH',
    '/api/v1/teams/KjkAJW/firewall',
    (c) => c.firewall.update(fixtureMap('firewall_update_request')),
    body: 'firewall_update_request',
    response: 'firewall',
  ),
  Call(
    'firewall.addEntry',
    'POST',
    '/api/v1/teams/KjkAJW/firewall_entries',
    (c) => c.firewall.addEntry(fixtureMap('firewall_entry_create_request')),
    body: 'firewall_entry_create_request',
    response: 'firewall_entry',
  ),
  Call('firewall.deleteEntry', 'DELETE', '/api/v1/firewall_entries/BnMkLo',
      (c) => c.firewall.deleteEntry("BnMkLo"),
      response: 'empty'),
];

PostShiba clientFor(http.Client httpClient, {String? teamId = "KjkAJW", String? baseUrl}) {
  return PostShiba('test-key', baseUrl: baseUrl, teamId: teamId, httpClient: httpClient);
}

void main() {
  test('Bearer header and baseUrl override', () async {
    http.Request? seen;
    final httpClient = MockClient((request) async {
      seen = request;
      return http.Response(jsonEncode(fixture('whoami')), 200, request: request);
    });

    await clientFor(
      httpClient,
      baseUrl: 'https://api.example.test',
    ).users.me();

    expect(seen!.url.origin, 'https://api.example.test');
    expect(seen!.url.path, '/api/v1/users/me');
    expect(seen!.headers['authorization'], 'Bearer test-key');
  });

  test('emails.send happy path', () async {
    http.Request? seen;
    final httpClient = MockClient((request) async {
      seen = request;
      return http.Response(
        jsonEncode(fixture('email_send_response')),
        200,
        request: request,
      );
    });

    final result = await clientFor(httpClient).emails.send(
      fixtureMap('email_send_request'),
    );

    expect(result, fixture('email_send_response'));
    expect(seen!.method, 'POST');
    expect(seen!.url.path, '/api/v1/emails');
    expect(jsonDecode(seen!.body), fixture('email_send_request'));
    expect(seen!.headers.containsKey('x-capsule-cluster-id'), isFalse);
  });

  test('emails.send pins cluster', () async {
    http.Request? seen;
    final httpClient = MockClient((request) async {
      seen = request;
      return http.Response(
        jsonEncode(fixture('email_send_response')),
        200,
        request: request,
      );
    });

    final result = await clientFor(httpClient).emails.send(
      fixtureMap('email_send_request'),
      clusterId: "NmQpXr",
    );

    expect(result, fixture('email_send_response'));
    expect(seen!.method, 'POST');
    expect(seen!.url.path, '/api/v1/emails');
    expect(seen!.headers['x-capsule-cluster-id'], '4');
  });

  test('cluster send with Idempotency-Key and sandbox', () async {
    http.Request? seen;
    final httpClient = MockClient((request) async {
      seen = request;
      return http.Response(
        jsonEncode(fixture('email_sandbox_response')),
        200,
        request: request,
      );
    });

    final result = await clientFor(httpClient).emails.sendOnCluster(
      4,
      fixtureMap('email_send_request'),
      idempotencyKey: 'idem-1',
      sandbox: true,
    );

    expect(result, fixture('email_sandbox_response'));
    expect(result['queued'], false);
    expect(seen!.method, 'POST');
    expect(seen!.url.path, '/api/v1/teams/KjkAJW/clusters/NmQpXr/sends');
    expect(seen!.headers['idempotency-key'], 'idem-1');
    expect(seen!.headers['authorization'], 'Bearer test-key');
    final body = jsonDecode(seen!.body) as Map<String, dynamic>;
    expect(body['sandbox'], true);
    expect(body['from'], fixtureMap('email_send_request')['from']);
  });

  group('operations', () {
    for (final op in operations) {
      test(op.name, () async {
        http.Request? seen;
        final payload = op.list ? [fixture(op.response!)] : fixture(op.response!);
        final httpClient = MockClient((request) async {
          seen = request;
          return http.Response(jsonEncode(payload), 200, request: request);
        });

        final result = await op.invoke(clientFor(httpClient));

        expect(seen!.method, op.method);
        expect(seen!.url.path, op.path);
        expect(seen!.headers['authorization'], 'Bearer test-key');
        if (op.body != null) {
          expect(jsonDecode(seen!.body), fixture(op.body!));
        }
        expect(result, payload);
      });
    }
  });

  test('messages.downloadAttachment path', () async {
    http.Request? seen;
    final httpClient = MockClient((request) async {
      seen = request;
      return http.Response.bytes(
        Uint8List.fromList([1, 2, 3]),
        200,
        request: request,
      );
    });

    final bytes = await clientFor(httpClient).messages.downloadAttachment("PqRzMn", "GxTyVu", 1);

    expect(seen!.method, 'GET');
    expect(seen!.url.path, '/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1');
    expect(bytes, [1, 2, 3]);
  });

  test('403 from error_403.json raises', () async {
    final httpClient = MockClient((request) async {
      return http.Response(jsonEncode(fixture('error_403')), 403, request: request);
    });

    try {
      await clientFor(httpClient).emails.send(fixtureMap('email_send_request'));
      fail('expected ApiException');
    } on ApiException catch (e) {
      expect(e.error, fixtureMap('error_403')['error']);
      expect(e.field, fixtureMap('error_403')['field']);
      expect(e.message, fixtureMap('error_403')['message']);
    }
  });

  test('422 from error_422.json raises', () async {
    final httpClient = MockClient((request) async {
      return http.Response(jsonEncode(fixture('error_422')), 422, request: request);
    });

    try {
      await clientFor(httpClient).emails.send(fixtureMap('email_send_request'));
      fail('expected ApiException');
    } on ApiException catch (e) {
      expect(e.error, fixtureMap('error_422')['error']);
      expect(e.field, fixtureMap('error_422')['field']);
      expect(e.message, fixtureMap('error_422')['message']);
    }
  });

  test('webhooks.verify accept and reject', () {
    final data = fixtureMap('webhook_verify');
    expect(
      Webhooks.verify(
        data['secret'] as String,
        data['body'] as String,
        data['signature'] as String,
        data['timestamp'] as String,
      ),
      isTrue,
    );
    expect(
      Webhooks.verify(
        data['secret'] as String,
        data['body'] as String,
        'sha256=deadbeef',
        data['timestamp'] as String,
      ),
      isFalse,
    );
  });

  test('SMTP password present on create, absent on delete', () async {
    final createClient = MockClient((request) async {
      return http.Response(
        jsonEncode(fixture('smtp_credential_create')),
        200,
        request: request,
      );
    });
    final created = await clientFor(createClient).smtpCredentials.create(
      4,
      fixtureMap('smtp_credential_create_request'),
    );
    expect(created['password'], 'once-only-password');

    final deleteClient = MockClient((request) async {
      return http.Response(
        jsonEncode(fixture('smtp_credential_deleted')),
        200,
        request: request,
      );
    });
    final deleted = await clientFor(deleteClient).smtpCredentials.delete("NmQpXr", "RvWsXq");
    expect(deleted.containsKey('password'), isFalse);
  });

  test('webhook secret omitted on list and update, present on get/create', () async {
    final listClient = MockClient((request) async {
      return http.Response(
        jsonEncode([fixture('webhook')]),
        200,
        request: request,
      );
    });
    final listed = await clientFor(listClient).webhooks.list();
    expect(listed.single.containsKey('secret'), isFalse);

    final getClient = MockClient((request) async {
      return http.Response(
        jsonEncode(fixture('webhook_show')),
        200,
        request: request,
      );
    });
    final shown = await clientFor(getClient).webhooks.get("CdFgHj");
    expect(shown['secret'], 'hex-secret');

    final createClient = MockClient((request) async {
      return http.Response(
        jsonEncode(fixture('webhook_show')),
        200,
        request: request,
      );
    });
    final created = await clientFor(createClient).webhooks.create(
      fixtureMap('webhook_create_request'),
    );
    expect(created['secret'], 'hex-secret');

    final updateClient = MockClient((request) async {
      return http.Response(
        jsonEncode(fixture('webhook')),
        200,
        request: request,
      );
    });
    final updated = await clientFor(updateClient).webhooks.update(
      2,
      fixtureMap('webhook_update_request'),
    );
    expect(updated, fixture('webhook'));
    expect(updated.containsKey('secret'), isFalse);
  });

  test('missing teamId raises on a team-scoped call', () async {
    final httpClient = MockClient((request) async {
      return http.Response('{}', 200, request: request);
    });

    expect(
      () => clientFor(httpClient, teamId: null).clusters.list(),
      throwsStateError,
    );
  });
}
