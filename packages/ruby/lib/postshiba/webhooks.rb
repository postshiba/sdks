# frozen_string_literal: true

require "openssl"

module PostShiba
  module Webhooks
    module_function

    def verify(payload:, signature:, secret:, timestamp:)
      provided = signature.to_s.sub(/\Asha256=/i, "")
      expected = OpenSSL::HMAC.hexdigest("SHA256", secret.to_s, "#{timestamp}.#{payload}")
      secure_compare(provided, expected)
    end

    def secure_compare(left, right)
      left = left.to_s
      right = right.to_s
      return false if left.bytesize != right.bytesize || left.empty?

      result = 0
      left.bytes.each_with_index do |byte, index|
        result |= byte ^ right.getbyte(index)
      end
      result.zero?
    end
  end
end
