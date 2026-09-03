# frozen_string_literal: true

require "json"
require "net/http"
require "uri"

require "postshiba/error"

module PostShiba
  class Client
    DEFAULT_BASE_URL = "https://app.postshiba.com"

    attr_reader :api_key, :base_url, :team_id, :http

    def initialize(api_key:, base_url: nil, team_id: nil, http: nil)
      @api_key = api_key
      @base_url = (base_url || DEFAULT_BASE_URL).to_s.chomp("/")
      @team_id = team_id
      @http = http
    end

    def users_me
      request(:get, "/api/v1/users/me")
    end

    def send_email(body)
      request(:post, "/api/v1/emails", body: body)
    end

    def send_on_cluster(cluster_id, body, idempotency_key: nil, sandbox: false)
      payload = JSON.parse(JSON.generate(body))
      payload["sandbox"] = true if sandbox
      headers = {}
      headers["Idempotency-Key"] = idempotency_key if idempotency_key
      request(:post, "/api/v1/teams/#{require_team_id}/clusters/#{cluster_id}/sends", body: payload, headers: headers)
    end

    def list_clusters
      request(:get, "/api/v1/teams/#{require_team_id}/clusters")
    end

    def get_cluster(id)
      request(:get, "/api/v1/clusters/#{id}")
    end

    def create_cluster(body)
      request(:post, "/api/v1/teams/#{require_team_id}/clusters", body: body)
    end

    def update_cluster(id, body)
      request(:patch, "/api/v1/clusters/#{id}", body: body)
    end

    def suspend_cluster(id)
      request(:post, "/api/v1/clusters/#{id}/suspend")
    end

    def resume_cluster(id)
      request(:post, "/api/v1/clusters/#{id}/resume")
    end

    def delete_cluster(id)
      request(:delete, "/api/v1/clusters/#{id}")
    end

    def list_sending_domains
      request(:get, "/api/v1/teams/#{require_team_id}/sending_domains")
    end

    def get_sending_domain(id)
      request(:get, "/api/v1/sending_domains/#{id}")
    end

    def create_sending_domain(body)
      request(:post, "/api/v1/teams/#{require_team_id}/sending_domains", body: body)
    end

    def verify_sending_domain(id)
      request(:post, "/api/v1/sending_domains/#{id}/verify")
    end

    def suspend_sending_domain(id)
      request(:post, "/api/v1/sending_domains/#{id}/suspend")
    end

    def resume_sending_domain(id)
      request(:post, "/api/v1/sending_domains/#{id}/resume")
    end

    def make_sending_domain_primary(id)
      request(:post, "/api/v1/sending_domains/#{id}/make_primary")
    end

    def delete_sending_domain(id)
      request(:delete, "/api/v1/sending_domains/#{id}")
    end

    def list_tenants
      request(:get, "/api/v1/teams/#{require_team_id}/tenants")
    end

    def get_tenant(id)
      request(:get, "/api/v1/tenants/#{id}")
    end

    def create_tenant(body)
      request(:post, "/api/v1/teams/#{require_team_id}/tenants", body: body)
    end

    def delete_tenant(id)
      request(:delete, "/api/v1/tenants/#{id}")
    end

    def list_inboxes
      request(:get, "/api/v1/teams/#{require_team_id}/inboxes")
    end

    def get_inbox(id)
      request(:get, "/api/v1/inboxes/#{id}")
    end

    def create_inbox(body)
      request(:post, "/api/v1/teams/#{require_team_id}/inboxes", body: body)
    end

    def verify_inbox(id)
      request(:post, "/api/v1/inboxes/#{id}/verify")
    end

    def delete_inbox(id)
      request(:delete, "/api/v1/inboxes/#{id}")
    end

    def list_messages(inbox_id)
      request(:get, "/api/v1/inboxes/#{inbox_id}/inbound_messages")
    end

    def get_message(inbox_id, id)
      request(:get, "/api/v1/inboxes/#{inbox_id}/inbound_messages/#{id}")
    end

    def download_attachment(inbox_id, id, index)
      request(:get, "/api/v1/inboxes/#{inbox_id}/inbound_messages/#{id}/attachments/#{index}", json: false)
    end

    def list_events(cluster_id)
      request(:get, "/api/v1/teams/#{require_team_id}/clusters/#{cluster_id}/message_events")
    end

    def get_event(id)
      request(:get, "/api/v1/message_events/#{id}")
    end

    def create_smtp_credential(cluster_id, body)
      request(:post, "/api/v1/teams/#{require_team_id}/clusters/#{cluster_id}/smtp_credentials", body: body)
    end

    def delete_smtp_credential(cluster_id, id)
      request(:delete, "/api/v1/teams/#{require_team_id}/clusters/#{cluster_id}/smtp_credentials/#{id}")
    end

    def list_webhooks
      request(:get, "/api/v1/teams/#{require_team_id}/webhook_endpoints")
    end

    def get_webhook(id)
      request(:get, "/api/v1/webhook_endpoints/#{id}")
    end

    def create_webhook(body)
      request(:post, "/api/v1/teams/#{require_team_id}/webhook_endpoints", body: body)
    end

    def update_webhook(id, body)
      request(:patch, "/api/v1/webhook_endpoints/#{id}", body: body)
    end

    def delete_webhook(id)
      request(:delete, "/api/v1/webhook_endpoints/#{id}")
    end

    def list_suppressions
      request(:get, "/api/v1/teams/#{require_team_id}/suppressions")
    end

    def create_suppression(body)
      request(:post, "/api/v1/teams/#{require_team_id}/suppressions", body: body)
    end

    def delete_suppression(id)
      request(:delete, "/api/v1/suppressions/#{id}")
    end

    def get_firewall
      request(:get, "/api/v1/teams/#{require_team_id}/firewall")
    end

    def update_firewall(body)
      request(:patch, "/api/v1/teams/#{require_team_id}/firewall", body: body)
    end

    def add_firewall_entry(body)
      request(:post, "/api/v1/teams/#{require_team_id}/firewall_entries", body: body)
    end

    def delete_firewall_entry(id)
      request(:delete, "/api/v1/firewall_entries/#{id}")
    end

    private

    def require_team_id
      raise ArgumentError, "team_id is required" if @team_id.nil? || @team_id.to_s.empty?

      @team_id
    end

    def request(method, path, body: nil, headers: {}, json: true)
      uri = URI.parse("#{@base_url}#{path}")
      req = http_class(method).new(uri.request_uri)
      req["Authorization"] = "Bearer #{@api_key}"
      req["Accept"] = "application/json"
      headers.each { |key, value| req[key] = value }

      unless body.nil?
        req["Content-Type"] = "application/json"
        req.body = body.is_a?(String) ? body : JSON.generate(body)
      end

      response = perform(uri, req)
      raise error_from(response) unless response.is_a?(Net::HTTPSuccess)
      return response.body unless json

      parse_json(response.body)
    end

    def perform(uri, req)
      return @http.request(req) if @http

      Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(req)
      end
    end

    def http_class(method)
      case method.to_s.upcase
      when "GET" then Net::HTTP::Get
      when "POST" then Net::HTTP::Post
      when "PATCH" then Net::HTTP::Patch
      when "DELETE" then Net::HTTP::Delete
      else
        raise ArgumentError, "unsupported HTTP method: #{method}"
      end
    end

    def parse_json(body)
      return {} if body.nil? || body.empty?

      JSON.parse(body)
    end

    def error_from(response)
      data = parse_json(response.body)
      data = {} unless data.is_a?(Hash)
      Error.new(
        data["message"] || "HTTP #{response.code}",
        error: data["error"],
        field: data["field"]
      )
    end
  end
end
