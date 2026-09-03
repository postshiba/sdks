<?php

namespace PostShiba;

class Firewall
{
    public function __construct(private PostShiba $client)
    {
    }

    public function get(): mixed
    {
        return $this->client->request('GET', '/api/v1/teams/'.$this->client->teamId().'/firewall');
    }

    public function update(array $params): mixed
    {
        return $this->client->request('PATCH', '/api/v1/teams/'.$this->client->teamId().'/firewall', $params);
    }

    public function addEntry(array $params): mixed
    {
        return $this->client->request('POST', '/api/v1/teams/'.$this->client->teamId().'/firewall_entries', $params);
    }

    public function deleteEntry(int|string $id): mixed
    {
        return $this->client->request('DELETE', '/api/v1/firewall_entries/'.$id);
    }
}
