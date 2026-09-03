<?php

namespace PostShiba\Tests;

use PHPUnit\Framework\TestCase;
use PostShiba\Client;
use PostShiba\Error;

final class ClientTest extends TestCase
{
    public function testPostsEmailsWithBearerAndJsonBody(): void
    {
        $seen = [];
        $http = function (string $url, array $args) use (&$seen): array {
            $seen = ['url' => $url, 'args' => $args];

            return ['status' => 200, 'body' => json_encode(['queued' => true, 'message_id' => 'm1'])];
        };

        $payload = [
            'from' => 'hello@mail.example.com',
            'to' => ['you@example.com'],
            'subject' => 'PostShiba test',
            'text' => 'hello from PostShiba',
        ];
        $got = (new Client('tok_test', 'https://api.example.test', $http))->send($payload);

        $this->assertSame('https://api.example.test/api/v1/emails', $seen['url']);
        $this->assertSame('Bearer tok_test', $seen['args']['headers']['Authorization']);
        $this->assertSame('application/json', $seen['args']['headers']['Content-Type']);
        $this->assertArrayNotHasKey('X-Capsule-Cluster-Id', $seen['args']['headers']);
        $this->assertSame($payload, json_decode($seen['args']['body'], true));
        $this->assertTrue($got['queued']);
        $this->assertSame('m1', $got['message_id']);
    }

    public function testSendPinsCluster(): void
    {
        $seen = [];
        $http = function (string $url, array $args) use (&$seen): array {
            $seen = ['url' => $url, 'args' => $args];

            return ['status' => 200, 'body' => json_encode(['queued' => true, 'message_id' => 'm1'])];
        };

        $payload = [
            'from' => 'hello@mail.example.com',
            'to' => ['you@example.com'],
            'subject' => 'PostShiba test',
            'text' => 'hello from PostShiba',
        ];
        (new Client('tok_test', 'https://api.example.test', $http))->send($payload, 'NmQpXr');

        $this->assertSame('https://api.example.test/api/v1/emails', $seen['url']);
        $this->assertSame('NmQpXr', $seen['args']['headers']['X-Capsule-Cluster-Id']);
    }

    public function test2xxReturnsDecodedJson(): void
    {
        $http = fn (): array => ['status' => 201, 'body' => json_encode(['queued' => true])];

        $got = (new Client('tok_test', 'https://app.postshiba.com', $http))->send([
            'from' => 'hello@mail.example.com',
            'to' => ['you@example.com'],
            'subject' => 'PostShiba test',
        ]);

        $this->assertTrue($got['queued']);
    }

    public function testError403(): void
    {
        $http = fn (): array => ['status' => 403, 'body' => json_encode([
            'error' => 'cluster_not_ready',
            'field' => 'cluster',
            'message' => 'No sending-ready cluster on this team',
            'dkim_private_key' => 'secret',
        ])];

        try {
            (new Client('tok_test', 'https://api.example.test', $http))->send([
                'from' => 'hello@mail.example.com',
                'to' => ['you@example.com'],
                'subject' => 'x',
            ]);
            $this->fail('expected Error');
        } catch (Error $e) {
            $this->assertSame('cluster_not_ready', $e->error);
            $this->assertSame('cluster', $e->field);
            $this->assertSame('No sending-ready cluster on this team', $e->getMessage());
            $this->assertSame(403, $e->status);
            $this->assertStringNotContainsString('dkim_private_key', $e->getMessage());
            $this->assertStringNotContainsString('secret', $e->getMessage());
        }
    }

    public function testError422(): void
    {
        $http = fn (): array => ['status' => 422, 'body' => json_encode([
            'error' => 'invalid',
            'field' => 'from',
            'message' => 'From domain is not verified',
        ])];

        try {
            (new Client('tok_test', 'https://api.example.test', $http))->send([
                'from' => 'hello@mail.example.com',
                'to' => ['you@example.com'],
                'subject' => 'x',
            ]);
            $this->fail('expected Error');
        } catch (Error $e) {
            $this->assertSame('invalid', $e->error);
            $this->assertSame('from', $e->field);
            $this->assertSame('From domain is not verified', $e->getMessage());
            $this->assertSame(422, $e->status);
        }
    }

    public function testScrubsDkimPrivateKeyFromSuccess(): void
    {
        $http = fn (): array => ['status' => 200, 'body' => json_encode([
            'queued' => true,
            'dkim_private_key' => 'secret',
        ])];

        $got = (new Client('tok_test', 'https://api.example.test', $http))->send([
            'from' => 'hello@mail.example.com',
            'to' => ['you@example.com'],
            'subject' => 'x',
        ]);

        $this->assertArrayNotHasKey('dkim_private_key', $got);
        $this->assertTrue($got['queued']);
    }
}
