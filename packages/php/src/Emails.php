<?php

namespace PostShiba;

class Emails
{
    public function __construct(private PostShiba $client)
    {
    }

    public function send(array $params, ?string $clusterId = null): mixed
    {
        $headers = [];
        if ($clusterId !== null && $clusterId !== '') {
            $headers['X-Capsule-Cluster-Id'] = (string) $clusterId;
        }

        return $this->client->request('POST', '/api/v1/emails', $params, $headers);
    }

    public function sendOnCluster(string $clusterId, array $params, ?string $idempotencyKey = null, bool $sandbox = false): mixed
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
