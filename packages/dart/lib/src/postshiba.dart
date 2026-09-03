import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  ApiException({this.error, this.field, this.message, this.statusCode});

  final String? error;
  final String? field;
  final String? message;
  final int? statusCode;

  factory ApiException.fromResponse(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        return ApiException(
          error: decoded['error'] as String?,
          field: decoded['field'] as String?,
          message: decoded['message'] as String?,
          statusCode: response.statusCode,
        );
      }
    } catch (_) {}
    return ApiException(
      message: response.body,
      statusCode: response.statusCode,
    );
  }

  @override
  String toString() => message ?? error ?? 'ApiException';
}

class Webhooks {
  static bool verify(
    String secret,
    String payload,
    String signature,
    String timestamp,
  ) {
    var expected = signature;
    if (expected.startsWith('sha256=')) {
      expected = expected.substring(7);
    }
    final digest = Hmac(sha256, utf8.encode(secret)).convert(
      utf8.encode('$timestamp.$payload'),
    );
    return _constantTimeEquals(digest.toString(), expected);
  }

  static bool _constantTimeEquals(String a, String b) {
    final aBytes = utf8.encode(a);
    final bBytes = utf8.encode(b);
    var mismatch = aBytes.length ^ bBytes.length;
    final n = aBytes.length < bBytes.length ? aBytes.length : bBytes.length;
    for (var i = 0; i < n; i++) {
      mismatch |= aBytes[i] ^ bBytes[i];
    }
    return mismatch == 0;
  }
}

class PostShiba {
  PostShiba(
    this.apiKey, {
    String? baseUrl,
    this.teamId,
    http.Client? httpClient,
  })  : baseUrl = _trimSlash(baseUrl ?? 'https://postshiba.com'),
        _http = httpClient ?? http.Client();

  final String apiKey;
  final String baseUrl;
  final Object? teamId;
  final http.Client _http;

  late final users = Users(this);
  late final emails = Emails(this);
  late final clusters = Clusters(this);
  late final sendingDomains = SendingDomains(this);
  late final tenants = Tenants(this);
  late final inboxes = Inboxes(this);
  late final messages = Messages(this);
  late final events = Events(this);
  late final smtpCredentials = SmtpCredentials(this);
  late final webhooks = WebhookEndpoints(this);
  late final suppressions = Suppressions(this);
  late final firewall = Firewall(this);

  static String _trimSlash(String url) {
    if (url.endsWith('/')) {
      return url.substring(0, url.length - 1);
    }
    return url;
  }

  String _teamPath(String rest) {
    if (teamId == null) {
      throw StateError('teamId is required');
    }
    return '/api/v1/teams/$teamId$rest';
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Object? body,
    Map<String, String>? headers,
    bool bytes = false,
  }) async {
    final req = http.Request(method, Uri.parse('$baseUrl$path'));
    req.headers['Authorization'] = 'Bearer $apiKey';
    req.headers['Accept'] = 'application/json';
    if (headers != null) {
      req.headers.addAll(headers);
    }
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }

    final response = await http.Response.fromStream(await _http.send(req));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException.fromResponse(response);
    }
    if (bytes) {
      return response.bodyBytes;
    }
    if (response.body.isEmpty) {
      return <String, dynamic>{};
    }
    return jsonDecode(response.body);
  }
}

Map<String, dynamic> _map(dynamic value) =>
    Map<String, dynamic>.from(value as Map);

List<dynamic> _list(dynamic value) => List<dynamic>.from(value as List);

class Users {
  Users(this._client);
  final PostShiba _client;

  Future<Map<String, dynamic>> me() async {
    return _map(await _client._request('GET', '/api/v1/users/me'));
  }
}

class Emails {
  Emails(this._client);
  final PostShiba _client;

  Future<Map<String, dynamic>> send(Map<String, dynamic> params) async {
    return _map(await _client._request('POST', '/api/v1/emails', body: params));
  }

  Future<Map<String, dynamic>> sendOnCluster(
    Object clusterId,
    Map<String, dynamic> params, {
    String? idempotencyKey,
    bool sandbox = false,
  }) async {
    final body = Map<String, dynamic>.from(params);
    if (sandbox) {
      body['sandbox'] = true;
    }
    return _map(await _client._request(
      'POST',
      _client._teamPath('/clusters/$clusterId/sends'),
      body: body,
      headers: {
        if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
      },
    ));
  }
}

class Clusters {
  Clusters(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list() async {
    return _list(await _client._request('GET', _client._teamPath('/clusters')));
  }

  Future<Map<String, dynamic>> get(Object id) async {
    return _map(await _client._request('GET', '/api/v1/clusters/$id'));
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/clusters'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> update(
    Object id,
    Map<String, dynamic> params,
  ) async {
    return _map(await _client._request(
      'PATCH',
      '/api/v1/clusters/$id',
      body: params,
    ));
  }

  Future<Map<String, dynamic>> suspend(Object id) async {
    return _map(await _client._request('POST', '/api/v1/clusters/$id/suspend'));
  }

  Future<Map<String, dynamic>> resume(Object id) async {
    return _map(await _client._request('POST', '/api/v1/clusters/$id/resume'));
  }

  Future<Map<String, dynamic>> delete(Object id) async {
    return _map(await _client._request('DELETE', '/api/v1/clusters/$id'));
  }
}

class SendingDomains {
  SendingDomains(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list() async {
    return _list(
      await _client._request('GET', _client._teamPath('/sending_domains')),
    );
  }

  Future<Map<String, dynamic>> get(Object id) async {
    return _map(await _client._request('GET', '/api/v1/sending_domains/$id'));
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/sending_domains'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> verify(Object id) async {
    return _map(
      await _client._request('POST', '/api/v1/sending_domains/$id/verify'),
    );
  }

  Future<Map<String, dynamic>> suspend(Object id) async {
    return _map(
      await _client._request('POST', '/api/v1/sending_domains/$id/suspend'),
    );
  }

  Future<Map<String, dynamic>> resume(Object id) async {
    return _map(
      await _client._request('POST', '/api/v1/sending_domains/$id/resume'),
    );
  }

  Future<Map<String, dynamic>> makePrimary(Object id) async {
    return _map(
      await _client._request('POST', '/api/v1/sending_domains/$id/make_primary'),
    );
  }

  Future<Map<String, dynamic>> delete(Object id) async {
    return _map(await _client._request('DELETE', '/api/v1/sending_domains/$id'));
  }
}

class Tenants {
  Tenants(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list() async {
    return _list(await _client._request('GET', _client._teamPath('/tenants')));
  }

  Future<Map<String, dynamic>> get(Object id) async {
    return _map(await _client._request('GET', '/api/v1/tenants/$id'));
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/tenants'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> delete(Object id) async {
    return _map(await _client._request('DELETE', '/api/v1/tenants/$id'));
  }
}

class Inboxes {
  Inboxes(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list() async {
    return _list(await _client._request('GET', _client._teamPath('/inboxes')));
  }

  Future<Map<String, dynamic>> get(Object id) async {
    return _map(await _client._request('GET', '/api/v1/inboxes/$id'));
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/inboxes'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> verify(Object id) async {
    return _map(await _client._request('POST', '/api/v1/inboxes/$id/verify'));
  }

  Future<Map<String, dynamic>> delete(Object id) async {
    return _map(await _client._request('DELETE', '/api/v1/inboxes/$id'));
  }
}

class Messages {
  Messages(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list(Object inboxId) async {
    return _list(await _client._request(
      'GET',
      '/api/v1/inboxes/$inboxId/inbound_messages',
    ));
  }

  Future<Map<String, dynamic>> get(Object inboxId, Object id) async {
    return _map(await _client._request(
      'GET',
      '/api/v1/inboxes/$inboxId/inbound_messages/$id',
    ));
  }

  Future<Uint8List> downloadAttachment(
    Object inboxId,
    Object id,
    Object index,
  ) async {
    return await _client._request(
      'GET',
      '/api/v1/inboxes/$inboxId/inbound_messages/$id/attachments/$index',
      bytes: true,
    ) as Uint8List;
  }
}

class Events {
  Events(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list(Object clusterId) async {
    return _list(await _client._request(
      'GET',
      _client._teamPath('/clusters/$clusterId/message_events'),
    ));
  }

  Future<Map<String, dynamic>> get(Object id) async {
    return _map(await _client._request('GET', '/api/v1/message_events/$id'));
  }
}

class SmtpCredentials {
  SmtpCredentials(this._client);
  final PostShiba _client;

  Future<Map<String, dynamic>> create(
    Object clusterId,
    Map<String, dynamic> params,
  ) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/clusters/$clusterId/smtp_credentials'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> delete(Object clusterId, Object id) async {
    return _map(await _client._request(
      'DELETE',
      _client._teamPath('/clusters/$clusterId/smtp_credentials/$id'),
    ));
  }
}

class WebhookEndpoints {
  WebhookEndpoints(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list() async {
    return _list(
      await _client._request('GET', _client._teamPath('/webhook_endpoints')),
    );
  }

  Future<Map<String, dynamic>> get(Object id) async {
    return _map(await _client._request('GET', '/api/v1/webhook_endpoints/$id'));
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/webhook_endpoints'),
      body: params,
    ));
  }
}

class Suppressions {
  Suppressions(this._client);
  final PostShiba _client;

  Future<List<dynamic>> list() async {
    return _list(
      await _client._request('GET', _client._teamPath('/suppressions')),
    );
  }

  Future<Map<String, dynamic>> create(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/suppressions'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> delete(Object id) async {
    return _map(await _client._request('DELETE', '/api/v1/suppressions/$id'));
  }
}

class Firewall {
  Firewall(this._client);
  final PostShiba _client;

  Future<Map<String, dynamic>> get() async {
    return _map(await _client._request('GET', _client._teamPath('/firewall')));
  }

  Future<Map<String, dynamic>> update(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'PATCH',
      _client._teamPath('/firewall'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> addEntry(Map<String, dynamic> params) async {
    return _map(await _client._request(
      'POST',
      _client._teamPath('/firewall_entries'),
      body: params,
    ));
  }

  Future<Map<String, dynamic>> deleteEntry(Object id) async {
    return _map(await _client._request('DELETE', '/api/v1/firewall_entries/$id'));
  }
}
