# frozen_string_literal: true

module PostShiba
  class Railtie < Rails::Railtie
    initializer "postshiba.action_mailer" do
      ActiveSupport.on_load(:action_mailer) do
        require "postshiba/action_mailer"
      end
    end
  end
end
