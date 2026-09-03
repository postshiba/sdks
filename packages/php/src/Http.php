<?php

namespace PostShiba;

interface Http
{
    /**
     * @param array<string, string> $headers
     * @return array{status: int, body: string}
     */
    public function send(string $method, string $url, array $headers, ?string $body): array;
}
