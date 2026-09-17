<?php

namespace PostShiba;

class Mail
{
    /**
     * Format a mailbox as `Name <email>` when a name is present.
     */
    public static function address(string $email, string $name = ''): string
    {
        $email = trim($email);
        $name = trim($name);
        if ($name === '') {
            return $email;
        }

        return $name.' <'.$email.'>';
    }

    /**
     * Map mailer fields onto emails.send.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public static function payload(array $input): array
    {
        $to = self::list($input['to'] ?? []);
        $attachments = [];
        foreach ($input['attachments'] ?? [] as $attachment) {
            if (!is_array($attachment)) {
                continue;
            }
            $attachments[] = [
                'filename' => $attachment['filename'] ?? $attachment['name'] ?? 'attachment',
                'content_type' => $attachment['content_type'] ?? $attachment['contentType'] ?? 'application/octet-stream',
                'content' => $attachment['content'] ?? '',
            ];
        }

        $out = [
            'from' => (string) ($input['from'] ?? ''),
            'to' => $to,
            'subject' => (string) ($input['subject'] ?? ''),
        ];

        if (array_key_exists('html', $input) && $input['html'] !== null) {
            $out['html'] = $input['html'];
        }
        if (array_key_exists('text', $input) && $input['text'] !== null) {
            $out['text'] = $input['text'];
        }

        $cc = self::list($input['cc'] ?? []);
        if ($cc !== []) {
            $out['cc'] = $cc;
        }
        $bcc = self::list($input['bcc'] ?? []);
        if ($bcc !== []) {
            $out['bcc'] = $bcc;
        }
        $replyTo = trim((string) ($input['reply_to'] ?? ''));
        if ($replyTo !== '') {
            $out['reply_to'] = $replyTo;
        }
        if ($attachments !== []) {
            $out['attachments'] = $attachments;
        }

        $headers = $input['headers'] ?? [];
        if (is_array($headers) && $headers !== []) {
            $out['headers'] = $headers;
        }
        $unique = $input['unique_args'] ?? [];
        if (is_array($unique) && $unique !== []) {
            $out['unique_args'] = $unique;
        }

        return $out;
    }

    /**
     * @param mixed $value
     * @return list<string>
     */
    private static function list(mixed $value): array
    {
        if (is_string($value)) {
            $value = $value === '' ? [] : [$value];
        }
        if (!is_array($value)) {
            return [];
        }

        $out = [];
        foreach ($value as $item) {
            $item = trim((string) $item);
            if ($item !== '') {
                $out[] = $item;
            }
        }

        return array_values($out);
    }
}
