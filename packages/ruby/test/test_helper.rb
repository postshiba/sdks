# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

require "json"
require "minitest/autorun"
require "webmock/minitest"
require "postshiba"

module FixtureHelper
  PACKAGE_ROOT = File.expand_path("..", __dir__)
  FIXTURES = File.expand_path("../../fixtures/catalog", PACKAGE_ROOT)

  def fixture_path(name)
    File.join(FIXTURES, "#{name}.json")
  end

  def fixture_json(name)
    File.read(fixture_path(name))
  end

  def fixture(name)
    JSON.parse(fixture_json(name))
  end
end
