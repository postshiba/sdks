# frozen_string_literal: true

require "test_helper"

class WebhooksTest < Minitest::Test
  include FixtureHelper

  def setup
    @fixture = fixture("webhook_verify")
  end

  def test_accepts_valid_signature
    assert PostShiba::Webhooks.verify(
      payload: @fixture["body"],
      signature: @fixture["signature"],
      secret: @fixture["secret"],
      timestamp: @fixture["timestamp"]
    )
  end

  def test_accepts_signature_without_prefix
    raw = @fixture["signature"].sub(/\Asha256=/, "")
    assert PostShiba::Webhooks.verify(
      payload: @fixture["body"],
      signature: raw,
      secret: @fixture["secret"],
      timestamp: @fixture["timestamp"]
    )
  end

  def test_rejects_invalid_signature
    refute PostShiba::Webhooks.verify(
      payload: @fixture["body"],
      signature: "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      secret: @fixture["secret"],
      timestamp: @fixture["timestamp"]
    )
  end

  def test_rejects_tampered_body
    refute PostShiba::Webhooks.verify(
      payload: '[{"event":"bounce"}]',
      signature: @fixture["signature"],
      secret: @fixture["secret"],
      timestamp: @fixture["timestamp"]
    )
  end
end
