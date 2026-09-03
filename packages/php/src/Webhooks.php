<?php

namespace PostShiba;

class Webhooks
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/webhook_endpoints');
    }

    public function get(int|string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/webhook_endpoints/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/webhook_endpoints', $params);
    }

    public static function verify(string $secret, string $timestamp, string $rawBody, string $signature): bool
    {
        if (str_starts_with($signature, 'sha256=')) {
            $signature = substr($signature, 7);
        }

        $expected = hash_hmac('sha256', $timestamp.'.'.$rawBody, $secret);

        return hash_equals($expected, $signature);
    }
}
