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

    public function get(string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/sending_domains/'.$id);
    }

    public function create(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/sending_domains', $params);
    }

    public function verify(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/verify');
    }

    public function suspend(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/suspend');
    }

    public function resume(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/resume');
    }

    public function makePrimary(string $id): mixed
    {
        return $this->client->request('POST', '/api/v1/sending_domains/'.$id.'/make_primary');
    }

    public function delete(string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/sending_domains/'.$id);
    }
}
