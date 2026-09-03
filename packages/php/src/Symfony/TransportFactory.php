<?php

namespace PostShiba\Symfony;

use PostShiba\PostShiba;
use Symfony\Component\Mailer\Transport\AbstractTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;
use Symfony\Component\Mailer\Transport\TransportInterface;

class TransportFactory extends AbstractTransportFactory
{
    public function create(Dsn $dsn): TransportInterface
    {
        return new Transport(new PostShiba(
            $this->getUser($dsn),
            $dsn->getOption('base_url') ?: $dsn->getOption('baseUrl'),
            $dsn->getOption('team_id') ?: $dsn->getOption('teamId'),
        ));
    }

    protected function getSupportedSchemes(): array
    {
        return ['postshiba', 'postshiba+api'];
    }
}
