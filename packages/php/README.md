# PostShiba PHP

> [!NOTE]
> [PostShiba skills](https://github.com/postshiba/postshiba-skills) connect agents to MCP for first send, domains, inboxes, and sandbox mail.

PHP client for the PostShiba API.

Install from GitHub. Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## Installation

```json
{
  "repositories": [
    {
      "type": "vcs",
      "url": "https://github.com/postshiba/postshiba-php"
    }
  ],
  "require": {
    "postshiba/postshiba": "dev-main"
  }
}
```

## How It Works

A thin HTTPS client. You pass a platform application token. Calls go to `/api/v1` as JSON. Team-scoped paths need `teamId` on the constructor. `GET /users/me` does not return one, so the client will not guess.

## Send an email

```php
use PostShiba\PostShiba;

$client = new PostShiba(getenv('POSTSHIBA_API_KEY'), null, 'KjkAJW');

$client->emails->send([
    'from' => 'hello@mail.example.com',
    'to' => ['you@example.com'],
    'subject' => 'PostShiba test',
    'text' => 'hello from PostShiba',
    'html' => '<p>hello from PostShiba</p>',
]);
```

Pass a cluster id to send `X-Capsule-Cluster-Id`. The path stays `POST /api/v1/emails`.

```php
$client->emails->send($params, 'NmQpXr');
```

Cluster send with an idempotency key and sandbox:

```php
$client->emails->sendOnCluster("NmQpXr", $params, 'idem-1', true);
```

Send a published template instead of html and text.

```php
$client->emails->send([
    'to' => ['you@example.com'],
    'template' => ['id' => 'welcome', 'variables' => ['name' => 'Ada']],
]);
```

## Mail adapter

The HTTP client loads without Laravel or Symfony. Adapters live in optional files and call `emails.send` without a cluster id. Call `$client->emails->send($params, 'NmQpXr')` yourself to pin a cluster.

### Laravel

Set the mailer to `postshiba`.

```php
// config/services.php
'postshiba' => [
    'key' => env('POSTSHIBA_API_KEY'),
    'team_id' => env('POSTSHIBA_TEAM_ID'),
],
```

```php
// config/mail.php
'postshiba' => [
    'transport' => 'postshiba',
],
```

```env
MAIL_MAILER=postshiba
POSTSHIBA_API_KEY=...
POSTSHIBA_TEAM_ID=1
```

```php
use Illuminate\Support\Facades\Mail;

Mail::raw('hello from PostShiba', function ($message) {
    $message->from('hello@mail.example.com')
        ->to('you@example.com')
        ->subject('PostShiba test');
});
```

The package registers `PostShiba\Laravel\PostShibaServiceProvider` through Composer.

### Symfony Mailer

```yaml
# config/services.yaml
services:
    PostShiba\Symfony\TransportFactory:
        tags: ['mailer.transport_factory']
```

```env
MAILER_DSN=postshiba://API_KEY@default?team_id=KjkAJW
```

```php
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mime\Email;
use PostShiba\PostShiba;
use PostShiba\Symfony\Transport;

$mailer = new Mailer(new Transport(new PostShiba(getenv('POSTSHIBA_API_KEY'), null, 'KjkAJW')));
$mailer->send(
    (new Email())
        ->from('hello@mail.example.com')
        ->to('you@example.com')
        ->subject('PostShiba test')
        ->text('hello from PostShiba')
        ->html('<p>hello from PostShiba</p>')
);
```

## API

```php
$client->users->me();
```

```php
$client->clusters->list();
$client->clusters->get("NmQpXr");
$client->clusters->create(['cluster' => ['name' => 'edge', 'size' => 'small', 'region' => 'manual', 'plan' => 'nano']]);
$client->clusters->update("NmQpXr", ['cluster' => ['plan' => 'small']]);
$client->clusters->suspend("NmQpXr");
$client->clusters->resume("NmQpXr");
$client->clusters->delete("NmQpXr");
$client->clusters->boost("NmQpXr", ['sku' => 'small_to_large']);
$client->clusters->extendBoost("NmQpXr", ['idempotency_key' => 'extend-1']);
$client->clusters->cancelBoost("NmQpXr");
```

```php
$client->network->list();
$client->network->create(['ip_address_id' => 'IpQwEr', 'cluster_id' => 'NmQpXr']);
$client->network->assign(['ip_address_id' => 'IpQwEr', 'cluster_id' => 'NmQpXr']);
$client->network->unassign(['ip_address_id' => 'IpQwEr', 'cluster_id' => 'NmQpXr']);
$client->network->switch(['ip_address_id' => 'IpQwEr', 'cluster_id' => 'NmQpXr']);
$client->network->release(['ip_address_id' => 'IpQwEr']);
```

```php
$client->sendingDomains->list();
$client->sendingDomains->get("HsVtYk");
$client->sendingDomains->create(['sending_domain' => ['name' => 'mail.example.com', 'tenant_id' => 12]]);
$client->sendingDomains->update("HsVtYk", ['sending_domain' => ['dkim_selector' => 's1', 'dkim_manual' => true]]);
$client->sendingDomains->refresh("HsVtYk");
$client->sendingDomains->verify("HsVtYk");
$client->sendingDomains->suspend("HsVtYk");
$client->sendingDomains->resume("HsVtYk");
$client->sendingDomains->makePrimary("HsVtYk");
$client->sendingDomains->delete("HsVtYk");
```

```php
$client->tenants->list();
$client->tenants->get("WbLcFd");
$client->tenants->create(['tenant' => ['name' => 'Acme Florist']]);
$client->tenants->delete("WbLcFd");
```

```php
$client->inboxes->list();
$client->inboxes->get("PqRzMn");
$client->inboxes->create(['inbox' => [
    'name' => 'agent',
    'webhook_url' => 'https://hooks.example.com/mail',
    'host' => 'inbound.example.com',
    'forward_to' => 'you@example.com',
]]);
$client->inboxes->verify("PqRzMn");
$client->inboxes->delete("PqRzMn");
```

```php
$client->messages->list("PqRzMn");
$client->messages->get("PqRzMn", "GxTyVu");
$client->messages->downloadAttachment('PqRzMn', 'GxTyVu', 1);
```

```php
$client->events->listTeam();
$client->events->list("NmQpXr");
$client->events->get("JkLmNp");
```

```php
$client->smtpCredentials->create("NmQpXr", ['smtp_credential' => ['tenant_id' => 12]]);
$client->smtpCredentials->delete("NmQpXr", "RvWsXq");
```

```php
$client->webhooks->list();
$client->webhooks->get("CdFgHj");
$client->webhooks->create(['webhook_endpoint' => [
    'url' => 'https://hooks.example.com/capsule',
    'event_types' => ['delivered', 'bounce'],
    'cluster_id' => 'NmQpXr',
]]);
$client->webhooks->update("CdFgHj", ['webhook_endpoint' => [
    'enabled' => false,
    'event_types' => ['delivered', 'bounce'],
]]);
$client->webhooks->delete("CdFgHj");
```

```php
$client->templates->list();
$client->templates->get("welcome");
$client->templates->create(['email_template' => [
    'name' => 'Welcome',
    'alias' => 'welcome',
    'subject' => 'Hi {{ name }}',
    'html' => '<p>Hi {{ name }}</p>',
]]);
$client->templates->update("TpLmQr", ['email_template' => ['subject' => 'Welcome, {{ name }}']]);
$client->templates->publish("TpLmQr");
$client->templates->duplicate("TpLmQr");
$client->templates->delete("TpLmQr");
```

```php
$client->suppressions->list();
$client->suppressions->create(['suppression' => ['email' => 'blocked@example.com', 'tenant_id' => 12]]);
$client->suppressions->import(['emails' => ['blocked@example.com', 'old@example.com'], 'tenant_id' => 'WbLcFd']);
$client->suppressions->delete("YtReWq");
```

```php
$client->firewall->get();
$client->firewall->update(['firewall' => ['enabled_checks' => ['temp_providers', 'plus_addressing']]]);
$client->firewall->addEntry(['firewall_entry' => ['list' => 'deny', 'value' => 'mailinator.com']]);
$client->firewall->deleteEntry("BnMkLo");
```

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`. A `sha256=` prefix is stripped. Compare is constant-time.

```php
use PostShiba\Webhooks;

$ok = Webhooks::verify($secret, $timestamp, $rawBody, $signature);
```

## Errors and throttling

Non-2xx responses raise `PostShiba\Error` with `error`, `field`, and `message`.

```php
use PostShiba\Error;

try {
    $client->emails->send($params);
} catch (Error $e) {
    $e->error;
    $e->field;
    $e->getMessage();
}
```

A `429` response with `error` `throttled` means the cluster hit its hourly send limit. Do not retry that send immediately. Immediate retries hit the same cap. Wait until the next hour. Laravel and Symfony transports do not delay the job. In a queued mailable, catch `Error` and check `$e->error === 'throttled'` before sending again. `$e->status` is the HTTP status.

Missing `teamId` on a team-scoped call raises `InvalidArgumentException`.

## Contributing

```sh
composer test
```

Tests mock HTTP. They do not call production.
