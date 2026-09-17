# frozen_string_literal: true

require "base64"
require "json"
require "postshiba/client"

module PostShiba
  module ActionMailer
    DROP_HEADERS = %w[
      bcc cc connection content-length content-transfer-encoding content-type
      date feedback-id from host keep-alive mime-version proxy-authenticate
      proxy-authorization received reply-to return-path sender subject te to
      trailer trailers transfer-encoding upgrade x-capsule-cluster-id
      x-capsule-unique-args x-complaints-to x-mailer x-report-abuse
    ].freeze

    class DeliveryMethod
      def initialize(settings = {})
        @settings = settings
      end

      def deliver!(mail)
        client.send_email(payload_from(mail), cluster_id: cluster_id_for(mail))
      end

      private

      def client
        @settings[:client] || Client.new(
          api_key: @settings.fetch(:api_key),
          base_url: @settings[:base_url],
          team_id: @settings[:team_id]
        )
      end

      def cluster_id_for(mail)
        field = mail["X-Capsule-Cluster-Id"]
        from_mail = field.respond_to?(:unparsed_value) ? field.unparsed_value : field
        from_mail = from_mail.to_s.strip unless from_mail.nil?
        return from_mail unless from_mail.nil? || from_mail.empty?

        @settings[:cluster_id]
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
        headers, unique_args = headers_from(mail)
        payload["headers"] = headers if headers.any?
        payload["unique_args"] = unique_args if unique_args
        payload
      end

      def headers_from(mail)
        extra = {}
        unique_args = nil
        mail.header_fields.each do |field|
          name = field.name.to_s
          value = header_value(field)
          next if value.nil? || value.empty?

          if name.downcase == "x-capsule-unique-args"
            parsed = parse_unique_args(value)
            unique_args = parsed if parsed
            next
          end
          next if DROP_HEADERS.include?(name.downcase)

          extra[name] = value
        end
        [extra, unique_args]
      end

      def header_value(field)
        raw = field.respond_to?(:unparsed_value) ? field.unparsed_value : field.value
        raw.to_s.strip
      end

      def parse_unique_args(value)
        parsed = JSON.parse(value)
        parsed if parsed.is_a?(Hash)
      rescue JSON::ParserError
        nil
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
