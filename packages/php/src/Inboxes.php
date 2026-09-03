<?php

namespace PostShiba;

class Inboxes
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/inboxes');
    }

    public function get(int|string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/inboxes/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/inboxes', $params);
    }

    public function verify(int|string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/inboxes/'.$id.'/verify');
    }

    public function delete(int|string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/inboxes/'.$id);
    }
}
