# PostShiba PHP

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

$client = new PostShiba(getenv('POSTSHIBA_API_KEY'), null, 1);

$client->emails->send([
    'from' => 'hello@mail.example.com',
    'to' => ['you@example.com'],
    'subject' => 'PostShiba test',
    'text' => 'hello from PostShiba',
    'html' => '<p>hello from PostShiba</p>',
]);
```

Cluster send with an idempotency key and sandbox:

```php
$client->emails->sendOnCluster(4, $params, 'idem-1', true);
```

## Mail adapter

The HTTP client loads without Laravel or Symfony. Adapters live in optional files and call `emails.send`.

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
MAILER_DSN=postshiba://API_KEY@default?team_id=1
```

```php
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mime\Email;
use PostShiba\PostShiba;
use PostShiba\Symfony\Transport;

$mailer = new Mailer(new Transport(new PostShiba(getenv('POSTSHIBA_API_KEY'), null, 1)));
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
$client->clusters->get(4);
$client->clusters->create(['cluster' => ['name' => 'edge', 'size' => 'small', 'region' => 'manual', 'plan' => 'nano']]);
$client->clusters->update(4, ['cluster' => ['plan' => 'small']]);
$client->clusters->suspend(4);
$client->clusters->resume(4);
$client->clusters->delete(4);
```

```php
$client->sendingDomains->list();
$client->sendingDomains->get(8);
$client->sendingDomains->create(['sending_domain' => ['name' => 'mail.example.com', 'tenant_id' => 12]]);
$client->sendingDomains->verify(8);
$client->sendingDomains->suspend(8);
$client->sendingDomains->resume(8);
$client->sendingDomains->makePrimary(8);
$client->sendingDomains->delete(8);
```

```php
$client->tenants->list();
$client->tenants->get(12);
$client->tenants->create(['tenant' => ['name' => 'Acme Florist']]);
$client->tenants->delete(12);
```

```php
$client->inboxes->list();
$client->inboxes->get(3);
$client->inboxes->create(['inbox' => ['name' => 'agent', 'webhook_url' => 'https://hooks.example.com/mail']]);
$client->inboxes->verify(3);
$client->inboxes->delete(3);
```

```php
$client->messages->list(3);
$client->messages->get(3, 21);
$client->messages->downloadAttachment(3, 21, 1);
```

```php
$client->events->list(4);
$client->events->get(44);
```

```php
$client->smtpCredentials->create(4, ['smtp_credential' => ['tenant_id' => 12]]);
$client->smtpCredentials->delete(4, 9);
```

```php
$client->webhooks->list();
$client->webhooks->get(2);
$client->webhooks->create(['webhook_endpoint' => [
    'url' => 'https://hooks.example.com/capsule',
    'event_types' => ['delivered', 'bounce'],
    'cluster_id' => 4,
]]);
$client->webhooks->update(2, ['webhook_endpoint' => [
    'enabled' => false,
    'event_types' => ['delivered', 'bounce'],
]]);
$client->webhooks->delete(2);
```

```php
$client->suppressions->list();
$client->suppressions->create(['suppression' => ['email' => 'blocked@example.com', 'tenant_id' => 12]]);
$client->suppressions->delete(7);
```

```php
$client->firewall->get();
$client->firewall->update(['firewall' => ['enabled_checks' => ['temp_providers', 'plus_addressing']]]);
$client->firewall->addEntry(['firewall_entry' => ['list' => 'deny', 'value' => 'mailinator.com']]);
$client->firewall->deleteEntry(3);
```

## Verify webhooks

HMAC-SHA256 of `{timestamp}.{rawBody}` against `X-Capsule-Signature`. A `sha256=` prefix is stripped. Compare is constant-time.

```php
use PostShiba\Webhooks;

$ok = Webhooks::verify($secret, $timestamp, $rawBody, $signature);
```

## Errors

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

Missing `teamId` on a team-scoped call raises `InvalidArgumentException`.

## Contributing

```sh
composer test
```

Tests mock HTTP. They do not call production.
