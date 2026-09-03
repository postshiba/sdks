<?php

namespace PostShiba;

class Tenants
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/tenants');
    }

    public function get(int|string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/tenants/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/tenants', $params);
    }

    public function delete(int|string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/tenants/'.$id);
    }
}
