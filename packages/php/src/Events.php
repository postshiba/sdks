<?php

namespace PostShiba;

class Events
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(int|string $clusterId): mixed
    {
        return $this->client->request(
            'GET',
            '/api/v1/teams/'.$this->client->teamId().'/clusters/'.$clusterId.'/message_events',
        );
    }

    public function get(int|string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/message_events/'.$id);
    }
}
