<?php

namespace PostShiba;

class Clusters
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/clusters');
    }

    public function get(string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/clusters/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/clusters', $params);
    }

    public function update(string $id, array $params): mixed
    {
        return $this->client->request('PATCH', '/api/v1/clusters/'.$id, $params);
    }

    public function suspend(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/clusters/'.$id.'/suspend');
    }

    public function resume(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/clusters/'.$id.'/resume');
    }

    public function delete(string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/clusters/'.$id);
    }

    public function boost(string $id, array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/clusters/'.$id.'/boost', $params);
    }

    public function extendBoost(string $id, array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/clusters/'.$id.'/extend_boost', $params);
    }

    public function cancelBoost(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/clusters/'.$id.'/cancel_boost');
    }
}
