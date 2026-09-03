<?php

namespace PostShiba\Symfony;

use PostShiba\Mail;
use PostShiba\PostShiba;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;

class Transport extends AbstractTransport
{
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
            'from' => self::first($email->getFrom()),
            'to' => self::addresses($email->getTo()),
            'subject' => (string) $email->getSubject(),
            'html' => $email->getHtmlBody(),
            'text' => $email->getTextBody(),
            'attachments' => $attachments,
        ]);
    }

    public function __toString(): string
    {
        return 'postshiba';
    }

    /**
     * @param Address[] $addresses
     */
    private static function first(array $addresses): string
    {
        return $addresses === [] ? '' : $addresses[0]->getAddress();
    }

    /**
     * @param Address[] $addresses
     * @return list<string>
     */
    private static function addresses(array $addresses): array
    {
        return array_values(array_map(static fn (Address $a) => $a->getAddress(), $addresses));
    }
}
