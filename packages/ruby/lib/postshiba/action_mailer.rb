# frozen_string_literal: true

require "base64"
require "postshiba/client"

module PostShiba
  module ActionMailer
    class DeliveryMethod
      def initialize(settings = {})
        @settings = settings
      end

      def deliver!(mail)
        client.send_email(payload_from(mail))
      end

      private

      def client
        @settings[:client] || Client.new(
          api_key: @settings.fetch(:api_key),
          base_url: @settings[:base_url],
          team_id: @settings[:team_id]
        )
      end

      def payload_from(mail)
        payload = {
          "from" => from_address(mail),
          "to" => Array(mail.to),
          "subject" => mail.subject
        }
        payload["cc"] = Array(mail.cc) if mail.cc
        payload["bcc"] = Array(mail.bcc) if mail.bcc
        payload["reply_to"] = reply_to_address(mail) if mail.reply_to
        payload.merge!(bodies_from(mail))
        attachments = attachments_from(mail)
        payload["attachments"] = attachments if attachments.any?
        payload
      end

      def from_address(mail)
        formatted = mail[:from]&.formatted
        return formatted.first if formatted.is_a?(Array) && formatted.any?

        Array(mail.from).first
      end

      def reply_to_address(mail)
        formatted = mail[:reply_to]&.formatted
        return formatted.first if formatted.is_a?(Array) && formatted.any?

        Array(mail.reply_to).first
      end

      def bodies_from(mail)
        bodies = {}
        if mail.multipart?
          bodies["text"] = mail.text_part.decoded if mail.text_part
          bodies["html"] = mail.html_part.decoded if mail.html_part
        elsif mail.mime_type == "text/html"
          bodies["html"] = mail.body.decoded
        else
          bodies["text"] = mail.body.decoded
        end
        bodies
      end

      def attachments_from(mail)
        mail.attachments.map do |part|
          {
            "filename" => part.filename,
            "content_type" => part.mime_type,
            "content" => Base64.strict_encode64(part.body.decoded)
          }
        end
      end
    end
  end
end

ActionMailer::Base.add_delivery_method :postshiba, PostShiba::ActionMailer::DeliveryMethod
