<?php

namespace PostShiba;

class SendingDomains
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/sending_domains');
    }

    public function get(int|string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/sending_domains/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/sending_domains', $params);
    }

    public function verify(int|string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/verify');
    }

    public function suspend(int|string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/suspend');
    }

    public function resume(int|string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/resume');
    }

    public function makePrimary(int|string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/make_primary');
    }

    public function delete(int|string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/sending_domains/'.$id);
    }
}
