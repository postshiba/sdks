<?php

namespace PostShiba;

class Messages
{
    public function __construct(private PostShiba $client)
    {
    }

    public function list(int|string $inboxId): mixed
    {
        return $this->client->request('GET', '/api/v1/inboxes/'.$inboxId.'/inbound_messages');
    }

    public function get(int|string $inboxId, int|string $id): mixed
    {
        return $this->client->request('GET', '/api/v1/inboxes/'.$inboxId.'/inbound_messages/'.$id);
    }

    public function downloadAttachment(int|string $inboxId, int|string $id, int|string $index): string
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
