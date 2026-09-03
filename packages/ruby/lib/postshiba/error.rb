# frozen_string_literal: true

module PostShiba
  class Error < StandardError
    attr_reader :error, :field

    def initialize(message = nil, error: nil, field: nil)
      @error = error
      @field = field
      super(message)
    end
  end
end
