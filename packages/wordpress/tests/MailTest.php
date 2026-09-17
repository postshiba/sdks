<?php

namespace PostShiba\Tests;

use PHPUnit\Framework\TestCase;
use PostShiba\Mail;

final class MailTest extends TestCase
{
    public function testMapsToFromSubjectText(): void
    {
        $payload = Mail::payload([
            'to' => 'you@example.com',
            'subject' => 'PostShiba test',
            'message' => 'hello from PostShiba',
        ], $this->settings());

        $this->assertSame('PostShiba <hello@mail.example.com>', $payload['from']);
        $this->assertSame(['you@example.com'], $payload['to']);
        $this->assertSame('PostShiba test', $payload['subject']);
        $this->assertSame('hello from PostShiba', $payload['text']);
        $this->assertArrayNotHasKey('html', $payload);
    }

    public function testHtmlContentTypeSetsHtmlAndTextFallback(): void
    {
        $payload = Mail::payload([
            'to' => 'you@example.com',
            'subject' => 'PostShiba test',
            'message' => '<p>hello from PostShiba</p>',
            'headers' => 'Content-Type: text/html; charset=UTF-8',
        ], $this->settings());

        $this->assertSame('<p>hello from PostShiba</p>', $payload['html']);
        $this->assertSame('hello from PostShiba', $payload['text']);
    }

    public function testCcBccReplyToFromHeaders(): void
    {
        $payload = Mail::payload([
            'to' => 'you@example.com',
            'subject' => 'PostShiba test',
            'message' => 'hello from PostShiba',
            'headers' => [
                'Cc: cc@example.com',
                'Bcc: bcc@example.com',
                'Reply-To: reply@example.com',
                'X-Campaign: cmp_123',
            ],
        ], $this->settings());

        $this->assertSame(['cc@example.com'], $payload['cc']);
        $this->assertSame(['bcc@example.com'], $payload['bcc']);
        $this->assertSame('reply@example.com', $payload['reply_to']);
        $this->assertSame(['X-Campaign' => 'cmp_123'], $payload['headers']);
    }

    public function testStripsNameAngleEmail(): void
    {
        $payload = Mail::payload([
            'to' => 'Jesse <you@example.com>',
            'subject' => 'PostShiba test',
            'message' => 'hello from PostShiba',
            'headers' => [
                'From: Docs <docs@mail.example.com>',
                'Cc: Copy <cc@example.com>, other@example.com',
            ],
        ], $this->settings());

        $this->assertSame(['you@example.com'], $payload['to']);
        $this->assertSame('Docs <docs@mail.example.com>', $payload['from']);
        $this->assertSame(['cc@example.com', 'other@example.com'], $payload['cc']);
    }

    public function testAttachmentPathBecomesBase64Payload(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'ps');
        $this->assertNotFalse($path);
        file_put_contents($path, 'hello-bytes');
        $named = $path.'.txt';
        rename($path, $named);

        try {
            $payload = Mail::payload([
                'to' => 'you@example.com',
                'subject' => 'PostShiba test',
                'message' => 'hello from PostShiba',
                'attachments' => [$named],
            ], $this->settings());

            $this->assertSame(basename($named), $payload['attachments'][0]['filename']);
            $this->assertSame(base64_encode('hello-bytes'), $payload['attachments'][0]['content']);
            $this->assertNotEmpty($payload['attachments'][0]['content_type']);
        } finally {
            unlink($named);
        }
    }

    public function testUniqueArgsFromXCapsuleUniqueArgsJson(): void
    {
        $payload = Mail::payload([
            'to' => 'you@example.com',
            'subject' => 'PostShiba test',
            'message' => 'hello from PostShiba',
            'headers' => 'X-Capsule-Unique-Args: {"campaign_id":"cmp_123","site":"docs"}',
        ], $this->settings());

        $this->assertSame([
            'campaign_id' => 'cmp_123',
            'site' => 'docs',
        ], $payload['unique_args']);
    }

    public function testThreadingHeadersStayInHeaders(): void
    {
        $payload = Mail::payload([
            'to' => 'you@example.com',
            'subject' => 'Re: PostShiba test',
            'message' => 'hello from PostShiba',
            'headers' => [
                'Message-ID: <msg-1@mail.example.com>',
                'In-Reply-To: <orig@mail.example.com>',
                'References: <orig@mail.example.com>',
            ],
        ], $this->settings());

        $this->assertSame('<msg-1@mail.example.com>', $payload['headers']['Message-ID']);
        $this->assertSame('<orig@mail.example.com>', $payload['headers']['In-Reply-To']);
        $this->assertSame('<orig@mail.example.com>', $payload['headers']['References']);
    }

    /**
     * @return array<string, mixed>
     */
    private function settings(): array
    {
        return [
            'api_key' => 'tok_test',
            'from_email' => 'hello@mail.example.com',
            'from_name' => 'PostShiba',
            'base_url' => 'https://app.postshiba.com',
            'enabled' => true,
        ];
    }
}
