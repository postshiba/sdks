<?php

namespace PostShiba;

class Suppressions
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/suppressions');
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/suppressions', $params);
    }

    public function delete(string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/suppressions/'.$id);
    }
}
