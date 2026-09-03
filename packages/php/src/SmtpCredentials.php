<?php

namespace PostShiba;

class SmtpCredentials
{
    public function __construct(private PostShiba $client)
    {
    }

    public function create(int|string $clusterId, array $params): mixed
    {
        return $this->client->request(
            'POST',
            '/api/v1/teams/'.$this->client->teamId().'/clusters/'.$clusterId.'/smtp_credentials',
            $params,
        );
    }

    public function delete(int|string $clusterId, int|string $id): mixed
    {
        return $this->client->request(
            'DELETE',
            '/api/v1/teams/'.$this->client->teamId().'/clusters/'.$clusterId.'/smtp_credentials/'.$id,
        );
    }
}
