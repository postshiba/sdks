<?php

namespace PostShiba\Tests;

use PHPUnit\Framework\TestCase;
use PostShiba\Mail;
use PostShiba\PostShiba;

final class MailTest extends TestCase
{
    public function testMapperSendsToFromSubjectHtmlTextAttachments(): void
    {
        $http = new FakeHttp();
        $http->enqueueJson(200, ['queued' => true, 'message_id' => 'm1']);
        $client = new PostShiba('tok_test', 'https://api.example.test', 'KjkAJW', $http);

        $payload = Mail::payload([
            'from' => 'hello@mail.example.com',
            'to' => 'you@example.com',
            'subject' => 'PostShiba test',
            'html' => '<p>hello from PostShiba</p>',
            'text' => 'hello from PostShiba',
            'attachments' => [
                [
                    'filename' => 'photo.png',
                    'content_type' => 'image/png',
                    'content' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                ],
            ],
        ]);

        $this->assertSame('hello@mail.example.com', $payload['from']);
        $this->assertSame(['you@example.com'], $payload['to']);
        $this->assertSame('PostShiba test', $payload['subject']);
        $this->assertSame('<p>hello from PostShiba</p>', $payload['html']);
        $this->assertSame('hello from PostShiba', $payload['text']);
        $this->assertSame('photo.png', $payload['attachments'][0]['filename']);
        $this->assertSame('image/png', $payload['attachments'][0]['content_type']);
        $this->assertNotEmpty($payload['attachments'][0]['content']);

        $client->emails->send($payload);

        $this->assertSame('POST', $http->last()['method']);
        $this->assertSame('https://api.example.test/api/v1/emails', $http->last()['url']);
        $this->assertSame($payload, json_decode($http->last()['body'], true));
    }

    public function testMapperAcceptsToArrayAndContentTypeAlias(): void
    {
        $payload = Mail::payload([
            'from' => 'a@example.com',
            'to' => ['b@example.com', 'c@example.com'],
            'subject' => 'Hi',
            'attachments' => [
                ['name' => 'note.txt', 'contentType' => 'text/plain', 'content' => 'dGVzdA=='],
            ],
        ]);

        $this->assertSame(['b@example.com', 'c@example.com'], $payload['to']);
        $this->assertSame('note.txt', $payload['attachments'][0]['filename']);
        $this->assertSame('text/plain', $payload['attachments'][0]['content_type']);
    }
}
