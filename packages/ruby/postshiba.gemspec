# frozen_string_literal: true

require_relative "lib/postshiba/version"

Gem::Specification.new do |spec|
  spec.name = "postshiba"
  spec.version = PostShiba::VERSION
  spec.authors = ["PostShiba"]
  spec.email = ["hello@postshiba.com"]
  spec.summary = "Ruby library for the PostShiba API"
  spec.homepage = "https://postshiba.com"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.1"

  spec.files = Dir["lib/**/*", "README.md"]
  spec.require_paths = ["lib"]

  spec.add_development_dependency "actionmailer", ">= 7.0"
  spec.add_development_dependency "minitest", ">= 5.0"
  spec.add_development_dependency "rake"
  spec.add_development_dependency "webmock"
end
