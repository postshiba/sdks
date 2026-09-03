<?php

namespace PostShiba;

class Error extends \RuntimeException
{
    public function __construct(
        public readonly string $error,
        public readonly ?string $field,
        string $message,
        public readonly int $status = 0,
    ) {
        parent::__construct($message, $status);
    }
}
