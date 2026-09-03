<?php

namespace PostShiba;

class Emails
{
    public function __construct(private PostShiba $client)
    {
    }

    public function send(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/emails', $params);
    }

    public function sendOnCluster(int|string $clusterId, array $params, ?string $idempotencyKey = null, bool $sandbox = false): mixed
    {
        if ($sandbox) {
            $params = array_merge($params, ['sandbox' => true]);
        }

        $headers = [];
        if ($idempotencyKey !== null && $idempotencyKey !== '') {
            $headers['Idempotency-Key'] = $idempotencyKey;
        }

        return $this->client->request(
            'POST',
            '/api/v1/teams/'.$this->client->teamId().'/clusters/'.$clusterId.'/sends',
            $params,
            $headers,
        );
    }
}
