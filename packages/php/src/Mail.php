<?php

namespace PostShiba;

class Mail
{
    /**
     * Map mailer fields onto emails.send.
     *
     * @param array<string, mixed> $input
     * @return array<string, mixed>
     */
    public static function payload(array $input): array
    {
        $to = $input['to'] ?? [];
        if (is_string($to)) {
            $to = [$to];
        }

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
            'to' => array_values($to),
            'subject' => (string) ($input['subject'] ?? ''),
        ];

        if (array_key_exists('html', $input) && $input['html'] !== null) {
            $out['html'] = $input['html'];
        }
        if (array_key_exists('text', $input) && $input['text'] !== null) {
            $out['text'] = $input['text'];
        }
        if ($attachments !== []) {
            $out['attachments'] = $attachments;
        }

        return $out;
    }
}
