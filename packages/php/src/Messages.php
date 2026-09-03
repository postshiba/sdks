<?php

namespace PostShiba;

class Messages
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(string $inboxId): mixed
    {
        return $this->client->request('GET', '/api/v1/inboxes/'.$inboxId.'/inbound_messages');
    }

    public function get(string $inboxId, string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/inboxes/'.$inboxId.'/inbound_messages/'.$id);
    }

    public function downloadAttachment(string $inboxId, string $id, int $index): string
    {
        return $this->client->request(
            'GET',
            '/api/v1/inboxes/'.$inboxId.'/inbound_messages/'.$id.'/attachments/'.$index,
            null,
            [],
            true,
        );
    }
}
