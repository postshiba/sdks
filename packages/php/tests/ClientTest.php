<?php

namespace PostShiba\Tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use PostShiba\Error;
use PostShiba\PostShiba;
use PostShiba\Webhooks;

final class ClientTest extends TestCase
{
    private const FIXTURES = __DIR__.'/../../../fixtures/catalog';

    public function testBearerHeaderAndBaseUrlOverride(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, $this->fixture('whoami'));
        $client = new PostShiba('tok_test', 'https://api.example.test/', 'KjkAJW', $http);

        $client->users->me();

        $this->assertSame('GET', $http->last()['method']);
        $this->assertSame('https://api.example.test/api/v1/users/me', $http->last()['url']);
        $this->assertSame('Bearer tok_test', $http->last()['headers']['Authorization']);
    }

    public function testDefaultBaseUrl(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, $this->fixture('whoami'));
        $client = new PostShiba('tok_test', null, 'KjkAJW', $http);

        $client->users->me();

        $this->assertSame('https://app.postshiba.com/api/v1/users/me', $http->last()['url']);
    }

    public function testEmailsSendHappyPath(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, $this->fixture('email_send_response'));
        $client = $this->client($http);

        $got = $client->emails->send($this->fixture('email_send_request'));

        $this->assertSame('POST', $http->last()['method']);
        $this->assertSame('https://api.example.test/api/v1/emails', $http->last()['url']);
        $this->assertSame($this->fixture('email_send_request'), json_decode($http->last()['body'], true));
        $this->assertTrue($got['queued']);
        $this->assertSame('abc@capsule.test', $got['message_id']);
        $this->assertArrayNotHasKey('X-Capsule-Cluster-Id', $http->last()['headers']);
    }

    public function testEmailsSendWithClusterId(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, $this->fixture('email_send_response'));
        $client = $this->client($http);

        $got = $client->emails->send($this->fixture('email_send_request'), 'NmQpXr');

        $this->assertSame('POST', $http->last()['method']);
        $this->assertSame('https://api.example.test/api/v1/emails', $http->last()['url']);
        $this->assertSame('NmQpXr', $http->last()['headers']['X-Capsule-Cluster-Id']);
        $this->assertSame($this->fixture('email_send_request'), json_decode($http->last()['body'], true));
        $this->assertTrue($got['queued']);
    }

    public function testSendOnClusterIdempotencyAndSandbox(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, $this->fixture('email_sandbox_response'));
        $client = $this->client($http);

        $got = $client->emails->sendOnCluster("NmQpXr", $this->fixture('email_send_request'), 'idem-1', true);

        $this->assertSame('POST', $http->last()['method']);
        $this->assertSame('https://api.example.test/api/v1/teams/KjkAJW/clusters/NmQpXr/sends', $http->last()['url']);
        $this->assertSame('idem-1', $http->last()['headers']['Idempotency-Key']);
        $body = json_decode($http->last()['body'], true);
        $this->assertTrue($body['sandbox']);
        $this->assertSame('PostShiba test', $body['subject']);
        $this->assertFalse($got['queued']);
    }

    /**
     * @dataProvider operations
     */
    public function testOperation(string $name, string $method, string $path, ?string $request, string $response, bool $list, callable $call): void
    {
        $http = new FakeHttp();
        $payload = $this->fixture($response);
        $http->enqueueJson(200, $list ? [$payload] : $payload);
        $client = $this->client($http);

        $got = $call($client);

        $this->assertSame($method, $http->last()['method'], $name);
        $this->assertSame('https://api.example.test'.$path, $http->last()['url'], $name);
        $this->assertSame('Bearer tok_test', $http->last()['headers']['Authorization'], $name);
        if ($request !== null) {
            $this->assertSame($this->fixture($request), json_decode($http->last()['body'], true), $name);
        }
        $this->assertSame($list ? [$payload] : $payload, $got, $name);
    }

    public static function operations(): array
    {
        return [
            'users.me' => ['users.me', 'GET', '/api/v1/users/me', null, 'whoami', false, fn ($c) => $c->users->me()],
            'emails.send' => ['emails.send', 'POST', '/api/v1/emails', 'email_send_request', 'email_send_response', false, fn ($c) => $c->emails->send(self::load('email_send_request'))],
            'emails.sendOnCluster' => ['emails.sendOnCluster', 'POST', '/api/v1/teams/KjkAJW/clusters/NmQpXr/sends', 'email_send_request', 'email_sandbox_response', false, fn ($c) => $c->emails->sendOnCluster("NmQpXr", self::load('email_send_request'))],
            'clusters.list' => ['clusters.list', 'GET', '/api/v1/teams/KjkAJW/clusters', null, 'cluster', true, fn ($c) => $c->clusters->list()],
            'clusters.get' => ['clusters.get', 'GET', '/api/v1/clusters/NmQpXr', null, 'cluster', false, fn ($c) => $c->clusters->get("NmQpXr")],
            'clusters.create' => ['clusters.create', 'POST', '/api/v1/teams/KjkAJW/clusters', 'cluster_create_request', 'cluster', false, fn ($c) => $c->clusters->create(self::load('cluster_create_request'))],
            'clusters.update' => ['clusters.update', 'PATCH', '/api/v1/clusters/NmQpXr', 'cluster_update_request', 'cluster_updated', false, fn ($c) => $c->clusters->update("NmQpXr", self::load('cluster_update_request'))],
            'clusters.suspend' => ['clusters.suspend', 'POST', '/api/v1/clusters/NmQpXr/suspend', null, 'cluster_suspended', false, fn ($c) => $c->clusters->suspend("NmQpXr")],
            'clusters.resume' => ['clusters.resume', 'POST', '/api/v1/clusters/NmQpXr/resume', null, 'cluster', false, fn ($c) => $c->clusters->resume("NmQpXr")],
            'clusters.delete' => ['clusters.delete', 'DELETE', '/api/v1/clusters/NmQpXr', null, 'cluster_deprovisioned', false, fn ($c) => $c->clusters->delete("NmQpXr")],
            'sendingDomains.list' => ['sendingDomains.list', 'GET', '/api/v1/teams/KjkAJW/sending_domains', null, 'sending_domain', true, fn ($c) => $c->sendingDomains->list()],
            'sendingDomains.get' => ['sendingDomains.get', 'GET', '/api/v1/sending_domains/HsVtYk', null, 'sending_domain', false, fn ($c) => $c->sendingDomains->get("HsVtYk")],
            'sendingDomains.create' => ['sendingDomains.create', 'POST', '/api/v1/teams/KjkAJW/sending_domains', 'sending_domain_create_request', 'sending_domain', false, fn ($c) => $c->sendingDomains->create(self::load('sending_domain_create_request'))],
            'sendingDomains.verify' => ['sendingDomains.verify', 'POST', '/api/v1/sending_domains/HsVtYk/verify', null, 'sending_domain', false, fn ($c) => $c->sendingDomains->verify("HsVtYk")],
            'sendingDomains.suspend' => ['sendingDomains.suspend', 'POST', '/api/v1/sending_domains/HsVtYk/suspend', null, 'sending_domain_suspended', false, fn ($c) => $c->sendingDomains->suspend("HsVtYk")],
            'sendingDomains.resume' => ['sendingDomains.resume', 'POST', '/api/v1/sending_domains/HsVtYk/resume', null, 'sending_domain', false, fn ($c) => $c->sendingDomains->resume("HsVtYk")],
            'sendingDomains.makePrimary' => ['sendingDomains.makePrimary', 'POST', '/api/v1/sending_domains/HsVtYk/make_primary', null, 'sending_domain_primary', false, fn ($c) => $c->sendingDomains->makePrimary("HsVtYk")],
            'sendingDomains.delete' => ['sendingDomains.delete', 'DELETE', '/api/v1/sending_domains/HsVtYk', null, 'empty', false, fn ($c) => $c->sendingDomains->delete("HsVtYk")],
            'tenants.list' => ['tenants.list', 'GET', '/api/v1/teams/KjkAJW/tenants', null, 'tenant', true, fn ($c) => $c->tenants->list()],
            'tenants.get' => ['tenants.get', 'GET', '/api/v1/tenants/WbLcFd', null, 'tenant', false, fn ($c) => $c->tenants->get("WbLcFd")],
            'tenants.create' => ['tenants.create', 'POST', '/api/v1/teams/KjkAJW/tenants', 'tenant_create_request', 'tenant', false, fn ($c) => $c->tenants->create(self::load('tenant_create_request'))],
            'tenants.delete' => ['tenants.delete', 'DELETE', '/api/v1/tenants/WbLcFd', null, 'empty', false, fn ($c) => $c->tenants->delete("WbLcFd")],
            'inboxes.list' => ['inboxes.list', 'GET', '/api/v1/teams/KjkAJW/inboxes', null, 'inbox_index', true, fn ($c) => $c->inboxes->list()],
            'inboxes.get' => ['inboxes.get', 'GET', '/api/v1/inboxes/PqRzMn', null, 'inbox', false, fn ($c) => $c->inboxes->get("PqRzMn")],
            'inboxes.create' => ['inboxes.create', 'POST', '/api/v1/teams/KjkAJW/inboxes', 'inbox_create_request', 'inbox', false, fn ($c) => $c->inboxes->create(self::load('inbox_create_request'))],
            'inboxes.verify' => ['inboxes.verify', 'POST', '/api/v1/inboxes/PqRzMn/verify', null, 'inbox_index', false, fn ($c) => $c->inboxes->verify("PqRzMn")],
            'inboxes.delete' => ['inboxes.delete', 'DELETE', '/api/v1/inboxes/PqRzMn', null, 'inbox_index', false, fn ($c) => $c->inboxes->delete("PqRzMn")],
            'messages.list' => ['messages.list', 'GET', '/api/v1/inboxes/PqRzMn/inbound_messages', null, 'message', true, fn ($c) => $c->messages->list("PqRzMn")],
            'messages.get' => ['messages.get', 'GET', '/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu', null, 'message_show', false, fn ($c) => $c->messages->get("PqRzMn", "GxTyVu")],
            'events.list' => ['events.list', 'GET', '/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events', null, 'event', true, fn ($c) => $c->events->list("NmQpXr")],
            'events.get' => ['events.get', 'GET', '/api/v1/message_events/JkLmNp', null, 'event', false, fn ($c) => $c->events->get("JkLmNp")],
            'smtpCredentials.create' => ['smtpCredentials.create', 'POST', '/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials', 'smtp_credential_create_request', 'smtp_credential_create', false, fn ($c) => $c->smtpCredentials->create("NmQpXr", self::load('smtp_credential_create_request'))],
            'smtpCredentials.delete' => ['smtpCredentials.delete', 'DELETE', '/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq', null, 'smtp_credential_deleted', false, fn ($c) => $c->smtpCredentials->delete("NmQpXr", "RvWsXq")],
            'webhooks.list' => ['webhooks.list', 'GET', '/api/v1/teams/KjkAJW/webhook_endpoints', null, 'webhook', true, fn ($c) => $c->webhooks->list()],
            'webhooks.get' => ['webhooks.get', 'GET', '/api/v1/webhook_endpoints/CdFgHj', null, 'webhook_show', false, fn ($c) => $c->webhooks->get("CdFgHj")],
            'webhooks.create' => ['webhooks.create', 'POST', '/api/v1/teams/KjkAJW/webhook_endpoints', 'webhook_create_request', 'webhook_show', false, fn ($c) => $c->webhooks->create(self::load('webhook_create_request'))],
            'webhooks.update' => ['webhooks.update', 'PATCH', '/api/v1/webhook_endpoints/CdFgHj', 'webhook_update_request', 'webhook', false, fn ($c) => $c->webhooks->update("CdFgHj", self::load('webhook_update_request'))],
            'webhooks.delete' => ['webhooks.delete', 'DELETE', '/api/v1/webhook_endpoints/CdFgHj', null, 'empty', false, fn ($c) => $c->webhooks->delete("CdFgHj")],
            'suppressions.list' => ['suppressions.list', 'GET', '/api/v1/teams/KjkAJW/suppressions', null, 'suppression', true, fn ($c) => $c->suppressions->list()],
            'suppressions.create' => ['suppressions.create', 'POST', '/api/v1/teams/KjkAJW/suppressions', 'suppression_create_request', 'suppression', false, fn ($c) => $c->suppressions->create(self::load('suppression_create_request'))],
            'suppressions.delete' => ['suppressions.delete', 'DELETE', '/api/v1/suppressions/YtReWq', null, 'empty', false, fn ($c) => $c->suppressions->delete("YtReWq")],
            'firewall.get' => ['firewall.get', 'GET', '/api/v1/teams/KjkAJW/firewall', null, 'firewall', false, fn ($c) => $c->firewall->get()],
            'firewall.update' => ['firewall.update', 'PATCH', '/api/v1/teams/KjkAJW/firewall', 'firewall_update_request', 'firewall', false, fn ($c) => $c->firewall->update(self::load('firewall_update_request'))],
            'firewall.addEntry' => ['firewall.addEntry', 'POST', '/api/v1/teams/KjkAJW/firewall_entries', 'firewall_entry_create_request', 'firewall_entry', false, fn ($c) => $c->firewall->addEntry(self::load('firewall_entry_create_request'))],
            'firewall.deleteEntry' => ['firewall.deleteEntry', 'DELETE', '/api/v1/firewall_entries/BnMkLo', null, 'empty', false, fn ($c) => $c->firewall->deleteEntry("BnMkLo")],
        ];
    }

    public function testDownloadAttachmentPath(): void
    {
        $http = new FakeHttp();
        $http->enqueue(200, 'PNGDATA');
        $client = $this->client($http);

        $got = $client->messages->downloadAttachment('PqRzMn', 'GxTyVu', 1);

        $this->assertSame('GET', $http->last()['method']);
        $this->assertSame('https://api.example.test/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1', $http->last()['url']);
        $this->assertSame('PNGDATA', $got);
    }

    public function testError403(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(403, $this->fixture('error_403'));
        $client = $this->client($http);

        try {
            $client->emails->send($this->fixture('email_send_request'));
            $this->fail('expected Error');
        } catch (Error $e) {
            $this->assertSame('cluster_not_ready', $e->error);
            $this->assertSame('cluster', $e->field);
            $this->assertSame('No sending-ready cluster on this team', $e->getMessage());
            $this->assertSame(403, $e->status);
        }
    }

    public function testError422(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(422, $this->fixture('error_422'));
        $client = $this->client($http);

        try {
            $client->emails->send($this->fixture('email_send_request'));
            $this->fail('expected Error');
        } catch (Error $e) {
            $this->assertSame('invalid', $e->error);
            $this->assertSame('from', $e->field);
            $this->assertSame('From domain is not verified', $e->getMessage());
            $this->assertSame(422, $e->status);
        }
    }

    public function testWebhookVerifyAcceptAndReject(): void
    {
        $fix = $this->fixture('webhook_verify');

        $this->assertTrue(Webhooks::verify($fix['secret'], $fix['timestamp'], $fix['body'], $fix['signature']));
        $this->assertFalse(Webhooks::verify($fix['secret'], $fix['timestamp'], $fix['body'], 'sha256=deadbeef'));
        $this->assertFalse(Webhooks::verify($fix['secret'], $fix['timestamp'], '[]', $fix['signature']));
    }

    public function testSmtpPasswordOnCreateAbsentOnDelete(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, $this->fixture('smtp_credential_create'));
        $http->enqueueJson(200, $this->fixture('smtp_credential_deleted'));
        $client = $this->client($http);

        $created = $client->smtpCredentials->create("NmQpXr", $this->fixture('smtp_credential_create_request'));
        $deleted = $client->smtpCredentials->delete("NmQpXr", "RvWsXq");

        $this->assertSame('once-only-password', $created['password']);
        $this->assertArrayNotHasKey('password', $deleted);
    }

    public function testWebhookSecretOmittedOnListAndUpdatePresentOnGetCreate(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, [$this->fixture('webhook')]);
        $http->enqueueJson(200, $this->fixture('webhook_show'));
        $http->enqueueJson(200, $this->fixture('webhook_show'));
        $http->enqueueJson(200, $this->fixture('webhook'));
        $client = $this->client($http);

        $listed = $client->webhooks->list();
        $shown = $client->webhooks->get("CdFgHj");
        $created = $client->webhooks->create($this->fixture('webhook_create_request'));
        $updated = $client->webhooks->update("CdFgHj", $this->fixture('webhook_update_request'));

        $this->assertArrayNotHasKey('secret', $listed[0]);
        $this->assertSame('hex-secret', $shown['secret']);
        $this->assertSame('hex-secret', $created['secret']);
        $this->assertSame($this->fixture('webhook'), $updated);
        $this->assertArrayNotHasKey('secret', $updated);
    }

    public function testMissingTeamIdRaises(): void
    {
        $client = new PostShiba('tok_test', 'https://api.example.test', null, new FakeHttp());

        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('teamId is required');
        $client->clusters->list();
    }

    public function testCoreAutoloadsWithoutFrameworks(): void
    {
        $this->assertFalse(class_exists(\Illuminate\Support\ServiceProvider::class, false));
        $this->assertFalse(class_exists(\Symfony\Component\Mailer\Transport\AbstractTransport::class, false));
        $this->assertTrue(class_exists(PostShiba::class));
    }

    private function client(FakeHttp $http): PostShiba
    {
        return new PostShiba('tok_test', 'https://api.example.test', 'KjkAJW', $http);
    }

    private function fixture(string $name): array
    {
        return self::load($name);
    }

    public static function load(string $name): array
    {
        return json_decode(file_get_contents(self::FIXTURES.'/'.$name.'.json'), true, 512, JSON_THROW_ON_ERROR);
    }
}
