# frozen_string_literal: true

require "postshiba/version"
require "postshiba/error"
require "postshiba/client"
require "postshiba/webhooks"
require "postshiba/railtie" if defined?(Rails::Railtie)
require "postshiba/action_mailer" if defined?(ActionMailer)

module PostShiba
  def self.new(...)
    Client.new(...)
  end
end
