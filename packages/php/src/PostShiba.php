<?php

namespace PostShiba;

class PostShiba
{
    public const DEFAULT_BASE_URL = 'https://app.postshiba.com';

    public Users $users;
    public Emails $emails;
    public Clusters $clusters;
    public SendingDomains $sendingDomains;
    public Tenants $tenants;
    public Inboxes $inboxes;
    public Messages $messages;
    public Events $events;
    public SmtpCredentials $smtpCredentials;
    public Webhooks $webhooks;
    public Suppressions $suppressions;
    public Firewall $firewall;

    private string $baseUrl;
    private Http $http;

    public function __construct(
        private string $apiKey,
        ?string $baseUrl = null,
        private string|int|null $teamId = null,
        ?Http $http = null,
    ) {
        $this->baseUrl = rtrim($baseUrl ?? self::DEFAULT_BASE_URL, '/');
        $this->http = $http ?? new StreamHttp();
        $this->users = new Users($this);
        $this->emails = new Emails($this);
        $this->clusters = new Clusters($this);
        $this->sendingDomains = new SendingDomains($this);
        $this->tenants = new Tenants($this);
        $this->inboxes = new Inboxes($this);
        $this->messages = new Messages($this);
        $this->events = new Events($this);
        $this->smtpCredentials = new SmtpCredentials($this);
        $this->webhooks = new Webhooks($this);
        $this->suppressions = new Suppressions($this);
        $this->firewall = new Firewall($this);
    }

    public function teamId(): string
    {
        if ($this->teamId === null || $this->teamId === '') {
            throw new \InvalidArgumentException('teamId is required');
        }

        return (string) $this->teamId;
    }

    /**
     * @param array<string, string> $headers
     */
    public function request(string $method, string $path, mixed $json = null, array $headers = [], bool $raw = false): mixed
    {
        $body = null;
        $reqHeaders = [
            'Authorization' => 'Bearer '.$this->apiKey,
            'Accept' => 'application/json',
        ];
        if ($json !== null) {
            $body = json_encode($json, JSON_THROW_ON_ERROR);
            $reqHeaders['Content-Type'] = 'application/json';
        }
        foreach ($headers as $name => $value) {
            $reqHeaders[$name] = $value;
        }

        $res = $this->http->send($method, $this->baseUrl.$path, $reqHeaders, $body);
        $status = $res['status'];
        $rawBody = $res['body'];

        if ($status < 200 || $status >= 300) {
            $data = json_decode($rawBody, true);
            if (!is_array($data)) {
                $data = [];
            }
            throw new Error(
                isset($data['error']) && is_string($data['error']) ? $data['error'] : 'http_error',
                isset($data['field']) && is_string($data['field']) ? $data['field'] : null,
                isset($data['message']) && is_string($data['message']) ? $data['message'] : $rawBody,
                $status,
            );
        }

        if ($raw) {
            return $rawBody;
        }

        if ($rawBody === '') {
            return [];
        }

        return json_decode($rawBody, true);
    }
}
