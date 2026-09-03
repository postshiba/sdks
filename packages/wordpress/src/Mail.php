<?php

namespace PostShiba;

class Mail
{
    private const DROP_HEADERS = [
        'bcc',
        'cc',
        'connection',
        'content-length',
        'content-type',
        'from',
        'host',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'reply-to',
        'te',
        'trailer',
        'trailers',
        'transfer-encoding',
        'upgrade',
        'x-capsule-unique-args',
    ];

    /**
     * @param array<string, mixed> $atts
     * @param array<string, mixed> $settings
     * @return array<string, mixed>
     */
    public static function payload(array $atts, array $settings): array
    {
        $headers = self::headerLines($atts['headers'] ?? []);
        $contentType = self::header($headers, 'content-type');
        $message = (string) ($atts['message'] ?? '');
        $html = self::isHtml($contentType, $message);

        $fromHeader = self::header($headers, 'from');
        if ($fromHeader !== '') {
            [$fromEmail, $fromName] = self::parseFrom($fromHeader);
        } else {
            $fromEmail = (string) ($settings['from_email'] ?? '');
            $fromName = (string) ($settings['from_name'] ?? '');
        }

        $out = [
            'from' => self::formatFrom($fromEmail, $fromName),
            'to' => self::addresses($atts['to'] ?? []),
            'subject' => (string) ($atts['subject'] ?? ''),
        ];

        if ($html) {
            $out['html'] = $message;
            $out['text'] = self::plainText($message);
        } else {
            $out['text'] = $message;
        }

        $cc = self::addresses(self::header($headers, 'cc'));
        if ($cc !== []) {
            $out['cc'] = $cc;
        }

        $bcc = self::addresses(self::header($headers, 'bcc'));
        if ($bcc !== []) {
            $out['bcc'] = $bcc;
        }

        $replyTo = self::addresses(self::header($headers, 'reply-to'));
        if ($replyTo !== []) {
            $out['reply_to'] = $replyTo[0];
        }

        $attachments = self::attachments($atts['attachments'] ?? []);
        if ($attachments !== []) {
            $out['attachments'] = $attachments;
        }

        $extra = [];
        foreach ($headers as $header) {
            $name = strtolower($header['name']);
            if (in_array($name, self::DROP_HEADERS, true)) {
                continue;
            }
            $extra[$header['name']] = $header['value'];
        }
        if ($extra !== []) {
            $out['headers'] = $extra;
        }

        $unique = self::header($headers, 'x-capsule-unique-args');
        if ($unique !== '') {
            $decoded = json_decode($unique, true);
            if (is_array($decoded)) {
                $out['unique_args'] = $decoded;
            }
        }

        return $out;
    }

    /**
     * @param mixed $headers
     * @return list<array{name: string, value: string}>
     */
    private static function headerLines(mixed $headers): array
    {
        if (is_string($headers)) {
            $headers = preg_split('/\r\n|\n|\r/', $headers) ?: [];
        }
        if (!is_array($headers)) {
            return [];
        }

        $out = [];
        foreach ($headers as $key => $line) {
            if (is_string($key) && !is_int($key)) {
                $out[] = ['name' => $key, 'value' => trim((string) $line)];
                continue;
            }
            $line = trim((string) $line);
            if ($line === '' || !str_contains($line, ':')) {
                continue;
            }
            [$name, $value] = explode(':', $line, 2);
            $out[] = ['name' => trim($name), 'value' => trim($value)];
        }

        return $out;
    }

    /**
     * @param list<array{name: string, value: string}> $headers
     */
    private static function header(array $headers, string $name): string
    {
        $values = [];
        foreach ($headers as $header) {
            if (strtolower($header['name']) === $name) {
                $values[] = $header['value'];
            }
        }

        return implode(', ', $values);
    }

    /**
     * @return list<string>
     */
    private static function addresses(mixed $value): array
    {
        if (is_array($value)) {
            $parts = $value;
        } else {
            $parts = preg_split('/\s*,\s*/', trim((string) $value)) ?: [];
        }

        $out = [];
        foreach ($parts as $part) {
            $email = self::email((string) $part);
            if ($email !== '') {
                $out[] = $email;
            }
        }

        return $out;
    }

    private static function email(string $value): string
    {
        $value = trim($value);
        if (preg_match('/<([^>]+)>/', $value, $match)) {
            return trim($match[1]);
        }

        return $value;
    }

    /**
     * @return array{0: string, 1: string}
     */
    private static function parseFrom(string $value): array
    {
        $value = trim($value);
        if (preg_match('/^(.*)<([^>]+)>\s*$/', $value, $match)) {
            return [trim($match[2]), trim($match[1], " \t\"'")];
        }

        return [$value, ''];
    }

    private static function formatFrom(string $email, string $name): string
    {
        if ($name === '') {
            return $email;
        }

        return $name.' <'.$email.'>';
    }

    private static function isHtml(string $contentType, string $message): bool
    {
        if (stripos($contentType, 'text/html') !== false) {
            return true;
        }

        return (bool) preg_match('/<\s*(?:html|body|div|p|br|table|span|a|h[1-6]|img|ul|ol|li)\b/i', $message);
    }

    private static function plainText(string $html): string
    {
        if (function_exists('wp_strip_all_tags')) {
            return wp_strip_all_tags($html);
        }

        return trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    /**
     * @return list<array{filename: string, content_type: string, content: string}>
     */
    private static function attachments(mixed $paths): array
    {
        if (!is_array($paths)) {
            $paths = $paths === '' || $paths === null ? [] : [(string) $paths];
        }

        $out = [];
        foreach ($paths as $path) {
            $path = (string) $path;
            if ($path === '' || !is_readable($path)) {
                continue;
            }
            $bytes = file_get_contents($path);
            if ($bytes === false) {
                continue;
            }
            $type = function_exists('mime_content_type') ? mime_content_type($path) : false;
            $out[] = [
                'filename' => basename($path),
                'content_type' => is_string($type) && $type !== '' ? $type : 'application/octet-stream',
                'content' => base64_encode($bytes),
            ];
        }

        return $out;
    }
}
