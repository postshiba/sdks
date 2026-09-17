<?php

namespace PostShiba\Symfony;

use PostShiba\Mail;
use PostShiba\PostShiba;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Header\HeaderInterface;
use Symfony\Component\Mime\MessageConverter;

class Transport extends AbstractTransport
{
    private const DROP_HEADERS = [
        'bcc',
        'cc',
        'connection',
        'content-length',
        'content-transfer-encoding',
        'content-type',
        'date',
        'feedback-id',
        'from',
        'host',
        'keep-alive',
        'mime-version',
        'proxy-authenticate',
        'proxy-authorization',
        'received',
        'reply-to',
        'return-path',
        'sender',
        'subject',
        'te',
        'to',
        'trailer',
        'trailers',
        'transfer-encoding',
        'upgrade',
        'x-capsule-cluster-id',
        'x-capsule-unique-args',
        'x-complaints-to',
        'x-mailer',
        'x-report-abuse',
    ];

    public function __construct(private PostShiba $client)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());
        $this->client->emails->send(self::map($email));
    }

    /**
     * @return array<string, mixed>
     */
    public static function map(Email $email): array
    {
        $attachments = [];
        foreach ($email->getAttachments() as $part) {
            $attachments[] = [
                'filename' => $part->getFilename() ?: 'attachment',
                'content_type' => $part->getMediaType().'/'.$part->getMediaSubtype(),
                'content' => base64_encode($part->getBody()),
            ];
        }

        return Mail::payload([
            'from' => self::named(self::firstAddress($email->getFrom())),
            'to' => self::addresses($email->getTo()),
            'cc' => self::addresses($email->getCc()),
            'bcc' => self::addresses($email->getBcc()),
            'reply_to' => self::named(self::firstAddress($email->getReplyTo())),
            'subject' => (string) $email->getSubject(),
            'html' => $email->getHtmlBody(),
            'text' => $email->getTextBody(),
            'attachments' => $attachments,
            'headers' => self::extraHeaders($email),
            'unique_args' => self::uniqueArgs($email),
        ]);
    }

    public function __toString(): string
    {
        return 'postshiba';
    }

    /**
     * @param Address[] $addresses
     */
    private static function firstAddress(array $addresses): ?Address
    {
        return $addresses === [] ? null : $addresses[0];
    }

    private static function named(?Address $address): string
    {
        if ($address === null) {
            return '';
        }

        return Mail::address($address->getAddress(), $address->getName());
    }

    /**
     * @param Address[] $addresses
     * @return list<string>
     */
    private static function addresses(array $addresses): array
    {
        return array_values(array_map(static fn (Address $a) => $a->getAddress(), $addresses));
    }

    /**
     * @return array<string, string>
     */
    private static function extraHeaders(Email $email): array
    {
        $out = [];
        foreach ($email->getHeaders()->all() as $header) {
            if (!$header instanceof HeaderInterface) {
                continue;
            }
            $name = $header->getName();
            if (in_array(strtolower($name), self::DROP_HEADERS, true)) {
                continue;
            }
            $value = trim($header->getBodyAsString());
            if ($value === '') {
                continue;
            }
            $out[$name] = $value;
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private static function uniqueArgs(Email $email): array
    {
        $header = $email->getHeaders()->get('X-Capsule-Unique-Args');
        if ($header === null) {
            return [];
        }
        $decoded = json_decode(trim($header->getBodyAsString()), true);

        return is_array($decoded) ? $decoded : [];
    }
}
