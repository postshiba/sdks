<?php

namespace PostShiba;

class Client
{
    public const DEFAULT_BASE_URL = 'https://app.postshiba.com';

    /**
     * @param (callable(string, array<string, mixed>): array{status: int, body: string})|null $http
     */
    public function __construct(
        private string $apiKey,
        private string $baseUrl = self::DEFAULT_BASE_URL,
        private mixed $http = null,
    ) {
        $this->baseUrl = rtrim($baseUrl !== '' ? $baseUrl : self::DEFAULT_BASE_URL, '/');
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function send(array $payload): array
    {
        $url = $this->baseUrl.'/api/v1/emails';
        $args = [
            'headers' => [
                'Authorization' => 'Bearer '.$this->apiKey,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'body' => json_encode($payload, JSON_THROW_ON_ERROR),
            'timeout' => 15,
        ];

        $http = $this->http ?? [self::class, 'wpPost'];
        $res = $http($url, $args);
        $status = (int) ($res['status'] ?? 0);
        $raw = (string) ($res['body'] ?? '');
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            $data = [];
        }
        $data = self::scrub($data);

        if ($status < 200 || $status >= 300) {
            throw new Error(
                isset($data['error']) && is_string($data['error']) ? $data['error'] : 'http_error',
                isset($data['field']) && is_string($data['field']) ? $data['field'] : null,
                isset($data['message']) && is_string($data['message']) ? $data['message'] : $raw,
                $status,
            );
        }

        return $data;
    }

    /**
     * @param array<string, mixed> $args
     * @return array{status: int, body: string}
     */
    public static function wpPost(string $url, array $args): array
    {
        $response = wp_remote_post($url, $args);
        if (is_wp_error($response)) {
            throw new Error('http_error', null, $response->get_error_message(), 0);
        }

        return [
            'status' => (int) wp_remote_retrieve_response_code($response),
            'body' => (string) wp_remote_retrieve_body($response),
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private static function scrub(array $data): array
    {
        unset($data['dkim_private_key']);
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = self::scrub($value);
            }
        }

        return $data;
    }
}
