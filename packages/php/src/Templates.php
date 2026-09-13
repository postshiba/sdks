<?php

namespace PostShiba;

class Templates
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/templates');
    }

    public function get(string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/templates/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/templates', $params);
    }

    public function update(string $id, array $params): mixed
    {
        return $this->client->request('PATCH', '/api/v1/templates/'.$id, $params);
    }

    public function publish(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/templates/'.$id.'/publish');
    }

    public function duplicate(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/templates/'.$id.'/duplicate');
    }

    public function delete(string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/templates/'.$id);
    }
}
