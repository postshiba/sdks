<?php

namespace PostShiba;

class Users
{
    public function __construct(private PostShiba $client)
    {
    }

    public function me(): mixed
    {
        return $this->client->request('GET', '/api/v1/users/me');
    }
}
