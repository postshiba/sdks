import Config

if Mix.env() == :test do
  config :swoosh, :api_client, false
end
