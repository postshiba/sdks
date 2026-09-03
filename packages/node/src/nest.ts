import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { PostShiba } from "./index.js";
import type { Json, PostShibaOptions } from "./index.js";

export { PostShiba, PostShibaError } from "./index.js";
export type { Id, Json, PostShibaOptions } from "./index.js";

export const POSTSHIBA = "POSTSHIBA";

export type MailFields = {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: unknown[];
};

export function sendMail(client: PostShiba, mail: MailFields) {
  const body: Json = {
    from: mail.from,
    to: Array.isArray(mail.to) ? mail.to : [mail.to],
    subject: mail.subject,
  };
  if (mail.html !== undefined) body.html = mail.html;
  if (mail.text !== undefined) body.text = mail.text;
  if (mail.attachments !== undefined) body.attachments = mail.attachments;
  return client.emails.send(body);
}

@Module({})
export class PostShibaModule {
  static register(options: { apiKey: string } & PostShibaOptions): DynamicModule {
    return {
      module: PostShibaModule,
      providers: [
        {
          provide: POSTSHIBA,
          useValue: new PostShiba(options.apiKey, options),
        },
      ],
      exports: [POSTSHIBA],
    };
  }
}
