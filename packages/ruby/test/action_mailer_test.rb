# frozen_string_literal: true

require "test_helper"
require "action_mailer"
require "mail"
require "base64"
require "postshiba/action_mailer"

class ActionMailerTest < Minitest::Test
  include FixtureHelper

  def setup
    @png = Base64.decode64(fixture("email_send_request").dig("attachments", 0, "content"))
  end

  def test_maps_mail_fields_to_send_email
    captured = nil
    stub_request(:post, "https://postshiba.com/api/v1/emails")
      .with { |req|
        captured = JSON.parse(req.body)
        req.headers["Authorization"] == "Bearer mail-key"
      }
      .to_return(status: 200, body: fixture_json("email_send_response"), headers: {"Content-Type" => "application/json"})

    mail = Mail.new
    mail.from = "hello@mail.example.com"
    mail.to = "you@example.com"
    mail.subject = "PostShiba test"
    mail.text_part = Mail::Part.new do
      body "hello from PostShiba"
    end
    mail.html_part = Mail::Part.new do
      content_type "text/html; charset=UTF-8"
      body "<p>hello from PostShiba</p>"
    end
    mail.attachments["photo.png"] = {mime_type: "image/png", content: @png}

    delivery = PostShiba::ActionMailer::DeliveryMethod.new(api_key: "mail-key")
    result = delivery.deliver!(mail)

    assert_equal fixture("email_send_response"), result
    assert_equal "hello@mail.example.com", captured["from"]
    assert_equal ["you@example.com"], captured["to"]
    assert_equal "PostShiba test", captured["subject"]
    assert_equal "hello from PostShiba", captured["text"]
    assert_equal "<p>hello from PostShiba</p>", captured["html"]
    assert_equal 1, captured["attachments"].length
    assert_equal "photo.png", captured["attachments"][0]["filename"]
    assert_equal "image/png", captured["attachments"][0]["content_type"]
    assert_equal fixture("email_send_request").dig("attachments", 0, "content"), captured["attachments"][0]["content"]
  end

  def test_delivery_method_registered
    assert ActionMailer::Base.delivery_methods.key?(:postshiba)
    assert_equal PostShiba::ActionMailer::DeliveryMethod, ActionMailer::Base.delivery_methods[:postshiba]
  end

  def test_action_mailer_base_settings
    captured = nil
    stub_request(:post, "https://custom.mail.test/api/v1/emails")
      .with { |req|
        captured = JSON.parse(req.body)
        req.headers["Authorization"] == "Bearer settings-key"
      }
      .to_return(status: 200, body: fixture_json("email_send_response"), headers: {"Content-Type" => "application/json"})

    mailer_class = Class.new(ActionMailer::Base) do
      self.delivery_method = :postshiba
      self.postshiba_settings = {api_key: "settings-key", base_url: "https://custom.mail.test"}
      self.perform_deliveries = true
      self.raise_delivery_errors = true

      def hello
        attachments["photo.png"] = {mime_type: "image/png", content: "x"}
        mail(from: "hello@mail.example.com", to: "you@example.com", subject: "PostShiba test") do |format|
          format.text { "hello from PostShiba" }
          format.html { "<p>hello from PostShiba</p>" }
        end
      end
    end

    mailer_class.hello.deliver_now
    assert_equal "hello@mail.example.com", captured["from"]
    assert_equal ["you@example.com"], captured["to"]
    assert_equal "PostShiba test", captured["subject"]
    assert_equal "hello from PostShiba", captured["text"]
    assert_equal "<p>hello from PostShiba</p>", captured["html"]
    assert_equal "photo.png", captured["attachments"][0]["filename"]
  end
end
