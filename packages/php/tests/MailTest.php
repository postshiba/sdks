<?php

namespace PostShiba\Tests;

use PHPUnit\Framework\TestCase;
use PostShiba\Mail;
use PostShiba\PostShiba;
use PostShiba\Symfony\Transport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

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

    public function testPayloadKeepsReplyToHeadersAndUniqueArgs(): void
    {
        $payload = Mail::payload([
            'from' => Mail::address('hello@mail.example.com', 'PostShiba'),
            'to' => ['you@example.com'],
            'cc' => ['cc@example.com'],
            'bcc' => ['bcc@example.com'],
            'reply_to' => Mail::address('hello@mail.example.com', 'Support'),
            'subject' => 'PostShiba test',
            'headers' => [
                'Message-ID' => '<msg-1@mail.example.com>',
                'In-Reply-To' => '<orig@mail.example.com>',
                'References' => '<orig@mail.example.com>',
                'X-Campaign' => 'cmp_123',
            ],
            'unique_args' => ['campaign_id' => 'cmp_123', 'site' => 'docs'],
        ]);

        $this->assertSame('PostShiba <hello@mail.example.com>', $payload['from']);
        $this->assertSame('Support <hello@mail.example.com>', $payload['reply_to']);
        $this->assertSame(['cc@example.com'], $payload['cc']);
        $this->assertSame(['bcc@example.com'], $payload['bcc']);
        $this->assertSame('<msg-1@mail.example.com>', $payload['headers']['Message-ID']);
        $this->assertSame('<orig@mail.example.com>', $payload['headers']['In-Reply-To']);
        $this->assertSame('<orig@mail.example.com>', $payload['headers']['References']);
        $this->assertSame('cmp_123', $payload['headers']['X-Campaign']);
        $this->assertSame(['campaign_id' => 'cmp_123', 'site' => 'docs'], $payload['unique_args']);
        $this->assertArrayNotHasKey('html', $payload);
    }

    public function testPayloadOmitsEmptyOptionalFields(): void
    {
        $payload = Mail::payload([
            'from' => 'hello@mail.example.com',
            'to' => 'you@example.com',
            'subject' => 'Hi',
            'cc' => [],
            'bcc' => '',
            'reply_to' => '',
            'headers' => [],
            'unique_args' => [],
        ]);

        $this->assertArrayNotHasKey('cc', $payload);
        $this->assertArrayNotHasKey('bcc', $payload);
        $this->assertArrayNotHasKey('reply_to', $payload);
        $this->assertArrayNotHasKey('headers', $payload);
        $this->assertArrayNotHasKey('unique_args', $payload);
    }

    public function testTransportMapCopiesDisplayNamesReplyToHeadersAndUniqueArgs(): void
    {
        $email = (new Email())
            ->from(new Address('hello@mail.example.com', 'PostShiba'))
            ->to('you@example.com')
            ->cc('cc@example.com')
            ->bcc('bcc@example.com')
            ->replyTo(new Address('hello@mail.example.com', 'Support'))
            ->subject('PostShiba test')
            ->html('<p>hello from PostShiba</p>')
            ->text('hello from PostShiba');
        $email->getHeaders()->addIdHeader('Message-ID', 'msg-1@mail.example.com');
        $email->getHeaders()->addTextHeader('In-Reply-To', '<orig@mail.example.com>');
        $email->getHeaders()->addTextHeader('References', '<orig@mail.example.com>');
        $email->getHeaders()->addTextHeader('X-Campaign', 'cmp_123');
        $email->getHeaders()->addTextHeader('X-Capsule-Unique-Args', '{"campaign_id":"cmp_123","site":"docs"}');

        $payload = Transport::map($email);

        $this->assertSame('PostShiba <hello@mail.example.com>', $payload['from']);
        $this->assertSame(['you@example.com'], $payload['to']);
        $this->assertSame(['cc@example.com'], $payload['cc']);
        $this->assertSame(['bcc@example.com'], $payload['bcc']);
        $this->assertSame('Support <hello@mail.example.com>', $payload['reply_to']);
        $this->assertSame('PostShiba test', $payload['subject']);
        $this->assertSame('<p>hello from PostShiba</p>', $payload['html']);
        $this->assertSame('hello from PostShiba', $payload['text']);
        $this->assertSame('<msg-1@mail.example.com>', $payload['headers']['Message-ID']);
        $this->assertSame('<orig@mail.example.com>', $payload['headers']['In-Reply-To']);
        $this->assertSame('<orig@mail.example.com>', $payload['headers']['References']);
        $this->assertSame('cmp_123', $payload['headers']['X-Campaign']);
        $this->assertArrayNotHasKey('X-Capsule-Unique-Args', $payload['headers']);
        $this->assertSame(['campaign_id' => 'cmp_123', 'site' => 'docs'], $payload['unique_args']);
    }
}
