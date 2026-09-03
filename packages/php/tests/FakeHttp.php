<?php

namespace PostShiba\Tests;

use PostShiba\Http;

final class FakeHttp implements Http
{
    /** @var list<array{method: string, url: string, headers: array<string, string>, body: ?string}> */
    public array $calls = [];

    /** @var list<array{status: int, body: string}> */
    public array $queue = [];

    public function enqueue(int $status, string $body): void
    {
        $this->queue[] = ['status' => $status, 'body' => $body];
    }

    public function enqueueJson(int $status, mixed $data): void
    {
        $this->enqueue($status, json_encode($data, JSON_THROW_ON_ERROR));
    }

    public function send(string $method, string $url, array $headers, ?string $body): array
    {
        $this->calls[] = compact('method', 'url', 'headers', 'body');

        return $this->queue === []
            ? ['status' => 200, 'body' => '{}']
            : array_shift($this->queue);
    }

    /** @return array{method: string, url: string, headers: array<string, string>, body: ?string} */
    public function last(): array
    {
        return $this->calls[array_key_last($this->calls)];
    }
}
