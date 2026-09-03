# frozen_string_literal: true

require "test_helper"

class ClientTest < Minitest::Test
  include FixtureHelper

  TEAM = 1
  CLUSTER = 4
  SENDING_DOMAIN = 8
  TENANT = 12
  INBOX = 3
  MESSAGE = 21
  EVENT = 44
  SMTP = 9
  SUPPRESSION = 7
  FIREWALL_ENTRY = 3
  WEBHOOK = 2

  def setup
    @client = PostShiba.new(api_key: "test-key", team_id: TEAM, base_url: "https://api.example.test")
  end

  def test_new_returns_client
    client = PostShiba.new(api_key: "k")
    assert_instance_of PostShiba::Client, client
    assert_equal "https://app.postshiba.com", client.base_url
  end

  def test_client_alias
    client = PostShiba::Client.new(api_key: "k", base_url: "https://custom.test")
    assert_equal "https://custom.test", client.base_url
  end

  def test_bearer_header_and_base_url_override
    stub_request(:get, "https://custom.test/api/v1/users/me")
      .with(headers: {"Authorization" => "Bearer abc"})
      .to_return(status: 200, body: fixture_json("whoami"), headers: {"Content-Type" => "application/json"})

    client = PostShiba.new(api_key: "abc", base_url: "https://custom.test")
    assert_equal fixture("whoami"), client.users_me
  end

  def test_send_email_happy_path
    stub_json(:post, "/api/v1/emails", "email_send_response", request: fixture("email_send_request"))
    assert_equal fixture("email_send_response"), @client.send_email(fixture("email_send_request"))
  end

  def test_send_on_cluster_idempotency_and_sandbox
    expected = fixture("email_send_request").merge("sandbox" => true)
    stub_request(:post, "https://api.example.test/api/v1/teams/#{TEAM}/clusters/#{CLUSTER}/sends")
      .with { |req|
        req.headers["Authorization"] == "Bearer test-key" &&
          req.headers["Idempotency-Key"] == "idem-1" &&
          JSON.parse(req.body) == expected
      }
      .to_return(status: 200, body: fixture_json("email_sandbox_response"), headers: {"Content-Type" => "application/json"})

    result = @client.send_on_cluster(CLUSTER, fixture("email_send_request"), idempotency_key: "idem-1", sandbox: true)
    assert_equal fixture("email_sandbox_response"), result
    assert_equal false, result["queued"]
  end

  def test_every_catalog_method
    catalog.each do |example|
      WebMock.reset!
      path = example[:path]
      http = example[:http]
      request_body = example[:request] ? fixture(example[:request]) : nil
      stub = stub_request(http, "https://api.example.test#{path}")
        .with { |req| matches_catalog_request?(req, request_body) }

      if example[:binary]
        stub.to_return(status: 200, body: "PNGDATA", headers: {"Content-Type" => "image/png"})
      else
        body = example[:list] ? JSON.generate([fixture(example[:response])]) : fixture_json(example[:response])
        stub.to_return(status: 200, body: body, headers: {"Content-Type" => "application/json"})
      end

      result = @client.public_send(example[:method], *example[:args])
      if example[:binary]
        assert_equal "PNGDATA", result, example[:method]
      elsif example[:list]
        assert_equal [fixture(example[:response])], result, example[:method]
      else
        assert_equal fixture(example[:response]), result, example[:method]
      end
      assert_requested stub
    end
  end

  def test_403_raises
    stub_request(:post, "https://api.example.test/api/v1/emails")
      .to_return(status: 403, body: fixture_json("error_403"), headers: {"Content-Type" => "application/json"})

    error = assert_raises(PostShiba::Error) { @client.send_email(fixture("email_send_request")) }
    assert_equal "cluster_not_ready", error.error
    assert_equal "cluster", error.field
    assert_equal "No sending-ready cluster on this team", error.message
  end

  def test_422_raises
    stub_request(:post, "https://api.example.test/api/v1/emails")
      .to_return(status: 422, body: fixture_json("error_422"), headers: {"Content-Type" => "application/json"})

    error = assert_raises(PostShiba::Error) { @client.send_email(fixture("email_send_request")) }
    assert_equal "invalid", error.error
    assert_equal "from", error.field
    assert_equal "From domain is not verified", error.message
  end

  def test_smtp_password_present_on_create_absent_on_delete
    stub_json(:post, "/api/v1/teams/#{TEAM}/clusters/#{CLUSTER}/smtp_credentials", "smtp_credential_create", request: fixture("smtp_credential_create_request"))
    created = @client.create_smtp_credential(CLUSTER, fixture("smtp_credential_create_request"))
    assert_equal "once-only-password", created["password"]

    stub_json(:delete, "/api/v1/teams/#{TEAM}/clusters/#{CLUSTER}/smtp_credentials/#{SMTP}", "smtp_credential_deleted")
    deleted = @client.delete_smtp_credential(CLUSTER, SMTP)
    refute deleted.key?("password")
  end

  def test_webhook_secret_omitted_on_list_present_on_get_and_create
    stub_request(:get, "https://api.example.test/api/v1/teams/#{TEAM}/webhook_endpoints")
      .to_return(status: 200, body: JSON.generate([fixture("webhook")]), headers: {"Content-Type" => "application/json"})
    listed = @client.list_webhooks
    refute listed.first.key?("secret")

    stub_json(:get, "/api/v1/webhook_endpoints/#{WEBHOOK}", "webhook_show")
    shown = @client.get_webhook(WEBHOOK)
    assert_equal "hex-secret", shown["secret"]

    stub_json(:post, "/api/v1/teams/#{TEAM}/webhook_endpoints", "webhook_show", request: fixture("webhook_create_request"))
    created = @client.create_webhook(fixture("webhook_create_request"))
    assert_equal "hex-secret", created["secret"]
  end

  def test_missing_team_id_raises_on_team_scoped_call
    client = PostShiba.new(api_key: "test-key")
    error = assert_raises(ArgumentError) { client.list_clusters }
    assert_match(/team_id/, error.message)
  end

  def test_users_me_does_not_require_team_id
    stub_request(:get, "https://app.postshiba.com/api/v1/users/me")
      .to_return(status: 200, body: fixture_json("whoami"), headers: {"Content-Type" => "application/json"})

    client = PostShiba.new(api_key: "test-key")
    assert_equal fixture("whoami"), client.users_me
  end

  def test_require_postshiba_without_action_mailer
    lib = File.expand_path("../lib", __dir__)
    script = <<~RUBY
      require "postshiba"
      abort "ActionMailer loaded" if defined?(ActionMailer)
      abort "missing client" unless defined?(PostShiba::Client)
      print "ok"
    RUBY
    output = IO.popen([{"RUBYOPT" => nil}, Gem.ruby, "-I", lib, "-e", script], &:read)
    assert_equal 0, $?.exitstatus, output
    assert_equal "ok", output
  end

  private

  def catalog
    [
      {method: :users_me, args: [], http: :get, path: "/api/v1/users/me", response: "whoami"},
      {method: :send_email, args: [fixture("email_send_request")], http: :post, path: "/api/v1/emails", request: "email_send_request", response: "email_send_response"},
      {method: :list_clusters, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/clusters", response: "cluster", list: true},
      {method: :get_cluster, args: [CLUSTER], http: :get, path: "/api/v1/clusters/#{CLUSTER}", response: "cluster"},
      {method: :create_cluster, args: [fixture("cluster_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/clusters", request: "cluster_create_request", response: "cluster"},
      {method: :update_cluster, args: [CLUSTER, fixture("cluster_update_request")], http: :patch, path: "/api/v1/clusters/#{CLUSTER}", request: "cluster_update_request", response: "cluster_updated"},
      {method: :suspend_cluster, args: [CLUSTER], http: :post, path: "/api/v1/clusters/#{CLUSTER}/suspend", response: "cluster_suspended"},
      {method: :resume_cluster, args: [CLUSTER], http: :post, path: "/api/v1/clusters/#{CLUSTER}/resume", response: "cluster"},
      {method: :delete_cluster, args: [CLUSTER], http: :delete, path: "/api/v1/clusters/#{CLUSTER}", response: "cluster_deprovisioned"},
      {method: :list_sending_domains, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/sending_domains", response: "sending_domain", list: true},
      {method: :get_sending_domain, args: [SENDING_DOMAIN], http: :get, path: "/api/v1/sending_domains/#{SENDING_DOMAIN}", response: "sending_domain"},
      {method: :create_sending_domain, args: [fixture("sending_domain_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/sending_domains", request: "sending_domain_create_request", response: "sending_domain"},
      {method: :verify_sending_domain, args: [SENDING_DOMAIN], http: :post, path: "/api/v1/sending_domains/#{SENDING_DOMAIN}/verify", response: "sending_domain"},
      {method: :suspend_sending_domain, args: [SENDING_DOMAIN], http: :post, path: "/api/v1/sending_domains/#{SENDING_DOMAIN}/suspend", response: "sending_domain_suspended"},
      {method: :resume_sending_domain, args: [SENDING_DOMAIN], http: :post, path: "/api/v1/sending_domains/#{SENDING_DOMAIN}/resume", response: "sending_domain"},
      {method: :make_sending_domain_primary, args: [SENDING_DOMAIN], http: :post, path: "/api/v1/sending_domains/#{SENDING_DOMAIN}/make_primary", response: "sending_domain_primary"},
      {method: :delete_sending_domain, args: [SENDING_DOMAIN], http: :delete, path: "/api/v1/sending_domains/#{SENDING_DOMAIN}", response: "empty"},
      {method: :list_tenants, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/tenants", response: "tenant", list: true},
      {method: :get_tenant, args: [TENANT], http: :get, path: "/api/v1/tenants/#{TENANT}", response: "tenant"},
      {method: :create_tenant, args: [fixture("tenant_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/tenants", request: "tenant_create_request", response: "tenant"},
      {method: :delete_tenant, args: [TENANT], http: :delete, path: "/api/v1/tenants/#{TENANT}", response: "empty"},
      {method: :list_inboxes, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/inboxes", response: "inbox_index", list: true},
      {method: :get_inbox, args: [INBOX], http: :get, path: "/api/v1/inboxes/#{INBOX}", response: "inbox"},
      {method: :create_inbox, args: [fixture("inbox_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/inboxes", request: "inbox_create_request", response: "inbox"},
      {method: :verify_inbox, args: [INBOX], http: :post, path: "/api/v1/inboxes/#{INBOX}/verify", response: "inbox_index"},
      {method: :delete_inbox, args: [INBOX], http: :delete, path: "/api/v1/inboxes/#{INBOX}", response: "inbox_index"},
      {method: :list_messages, args: [INBOX], http: :get, path: "/api/v1/inboxes/#{INBOX}/inbound_messages", response: "message", list: true},
      {method: :get_message, args: [INBOX, MESSAGE], http: :get, path: "/api/v1/inboxes/#{INBOX}/inbound_messages/#{MESSAGE}", response: "message_show"},
      {method: :download_attachment, args: [INBOX, MESSAGE, 1], http: :get, path: "/api/v1/inboxes/#{INBOX}/inbound_messages/#{MESSAGE}/attachments/1", binary: true},
      {method: :list_events, args: [CLUSTER], http: :get, path: "/api/v1/teams/#{TEAM}/clusters/#{CLUSTER}/message_events", response: "event", list: true},
      {method: :get_event, args: [EVENT], http: :get, path: "/api/v1/message_events/#{EVENT}", response: "event"},
      {method: :create_smtp_credential, args: [CLUSTER, fixture("smtp_credential_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/clusters/#{CLUSTER}/smtp_credentials", request: "smtp_credential_create_request", response: "smtp_credential_create"},
      {method: :delete_smtp_credential, args: [CLUSTER, SMTP], http: :delete, path: "/api/v1/teams/#{TEAM}/clusters/#{CLUSTER}/smtp_credentials/#{SMTP}", response: "smtp_credential_deleted"},
      {method: :list_webhooks, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/webhook_endpoints", response: "webhook", list: true},
      {method: :get_webhook, args: [WEBHOOK], http: :get, path: "/api/v1/webhook_endpoints/#{WEBHOOK}", response: "webhook_show"},
      {method: :create_webhook, args: [fixture("webhook_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/webhook_endpoints", request: "webhook_create_request", response: "webhook_show"},
      {method: :list_suppressions, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/suppressions", response: "suppression", list: true},
      {method: :create_suppression, args: [fixture("suppression_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/suppressions", request: "suppression_create_request", response: "suppression"},
      {method: :delete_suppression, args: [SUPPRESSION], http: :delete, path: "/api/v1/suppressions/#{SUPPRESSION}", response: "empty"},
      {method: :get_firewall, args: [], http: :get, path: "/api/v1/teams/#{TEAM}/firewall", response: "firewall"},
      {method: :update_firewall, args: [fixture("firewall_update_request")], http: :patch, path: "/api/v1/teams/#{TEAM}/firewall", request: "firewall_update_request", response: "firewall"},
      {method: :add_firewall_entry, args: [fixture("firewall_entry_create_request")], http: :post, path: "/api/v1/teams/#{TEAM}/firewall_entries", request: "firewall_entry_create_request", response: "firewall_entry"},
      {method: :delete_firewall_entry, args: [FIREWALL_ENTRY], http: :delete, path: "/api/v1/firewall_entries/#{FIREWALL_ENTRY}", response: "empty"}
    ]
  end

  def stub_json(method, path, response_name, request: nil)
    stub_request(method, "https://api.example.test#{path}")
      .with { |req| matches_catalog_request?(req, request) }
      .to_return(status: 200, body: fixture_json(response_name), headers: {"Content-Type" => "application/json"})
  end

  def matches_catalog_request?(req, request_body)
    return false unless req.headers["Authorization"] == "Bearer test-key"
    return true if request_body.nil?

    JSON.parse(req.body) == request_body
  end
end
