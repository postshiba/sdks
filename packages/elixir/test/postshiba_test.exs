defmodule PostShibaTest do
  use ExUnit.Case, async: true

  alias PostShiba.Catalog

  setup do
    bypass = Bypass.open()
    client = PostShiba.new("sk_test", "http://127.0.0.1:#{bypass.port}", 1)
    {:ok, bypass: bypass, client: client}
  end

  test "sends Bearer auth and honors baseUrl", %{bypass: bypass} do
    Bypass.expect(bypass, "GET", "/api/v1/users/me", fn conn ->
      assert Plug.Conn.get_req_header(conn, "authorization") == ["Bearer sk_test"]
      json_resp(conn, Catalog.fixture("whoami"))
    end)

    client = PostShiba.new("sk_test", "http://127.0.0.1:#{bypass.port}/")
    assert PostShiba.Users.me(client) == Catalog.fixture("whoami")
  end

  test "sends an email", %{bypass: bypass, client: client} do
    body = Catalog.fixture("email_send_request")

    Bypass.expect(bypass, "POST", "/api/v1/emails", fn conn ->
      assert Plug.Conn.get_req_header(conn, "content-type")
             |> List.first()
             |> String.starts_with?("application/json")

      assert read_json(conn) == body
      json_resp(conn, Catalog.fixture("email_send_response"))
    end)

    assert PostShiba.Emails.send(client, body) == Catalog.fixture("email_send_response")
  end

  test "sends on a cluster with Idempotency-Key and sandbox", %{bypass: bypass, client: client} do
    body = Catalog.fixture("email_send_request")

    Bypass.expect(bypass, "POST", "/api/v1/teams/1/clusters/4/sends", fn conn ->
      assert Plug.Conn.get_req_header(conn, "idempotency-key") == ["ikey-1"]
      assert read_json(conn) == Map.put(body, "sandbox", true)
      json_resp(conn, Catalog.fixture("email_sandbox_response"))
    end)

    result =
      PostShiba.Emails.send_on_cluster(client, 4, body, idempotency_key: "ikey-1", sandbox: true)

    assert result == Catalog.fixture("email_sandbox_response")
  end

  test "covers every contract method", %{bypass: bypass, client: client} do
    Enum.each(contract_cases(), fn {name, call, method, path, request, response} ->
      Bypass.expect(bypass, method, path, fn conn ->
        if request do
          assert read_json(conn) == Catalog.fixture(request), name
        end

        json_resp(conn, response)
      end)

      assert call.(client) == response, name
    end)

    Bypass.expect(bypass, "GET", "/api/v1/inboxes/3/inbound_messages/21/attachments/1", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/octet-stream")
      |> Plug.Conn.resp(200, "png")
    end)

    assert PostShiba.Messages.download_attachment(client, 3, 21, 1) == "png"
  end

  test "raises 403 and 422 from fixtures", %{bypass: bypass, client: client} do
    Bypass.expect(bypass, "POST", "/api/v1/teams/1/clusters", fn conn ->
      json_resp(conn, Catalog.fixture("error_403"), 403)
    end)

    err_403 =
      assert_raise PostShiba.Error, fn ->
        PostShiba.Clusters.create(client, Catalog.fixture("cluster_create_request"))
      end

    assert err_403.error == Catalog.fixture("error_403")["error"]
    assert err_403.field == Catalog.fixture("error_403")["field"]
    assert err_403.message == Catalog.fixture("error_403")["message"]

    Bypass.expect(bypass, "POST", "/api/v1/emails", fn conn ->
      json_resp(conn, Catalog.fixture("error_422"), 422)
    end)

    err_422 =
      assert_raise PostShiba.Error, fn ->
        PostShiba.Emails.send(client, Catalog.fixture("email_send_request"))
      end

    assert err_422.error == Catalog.fixture("error_422")["error"]
    assert err_422.field == Catalog.fixture("error_422")["field"]
    assert err_422.message == Catalog.fixture("error_422")["message"]
  end

  test "verifies webhook signatures" do
    sample = Catalog.fixture("webhook_verify")

    assert PostShiba.Webhooks.verify(
             sample["body"],
             sample["timestamp"],
             sample["signature"],
             sample["secret"]
           )

    refute PostShiba.Webhooks.verify(
             sample["body"],
             sample["timestamp"],
             "sha256=00",
             sample["secret"]
           )
  end

  test "returns SMTP password on create and omits it on delete", %{bypass: bypass, client: client} do
    Bypass.expect(bypass, "POST", "/api/v1/teams/1/clusters/4/smtp_credentials", fn conn ->
      json_resp(conn, Catalog.fixture("smtp_credential_create"))
    end)

    created =
      PostShiba.SmtpCredentials.create(
        client,
        4,
        Catalog.fixture("smtp_credential_create_request")
      )

    assert created["password"] == "once-only-password"

    Bypass.expect(bypass, "DELETE", "/api/v1/teams/1/clusters/4/smtp_credentials/9", fn conn ->
      json_resp(conn, Catalog.fixture("smtp_credential_deleted"))
    end)

    deleted = PostShiba.SmtpCredentials.delete(client, 4, 9)
    refute Map.has_key?(deleted, "password")
  end

  test "omits webhook secret on list and update and returns it on get and create", %{
    bypass: bypass,
    client: client
  } do
    Bypass.expect(bypass, "GET", "/api/v1/teams/1/webhook_endpoints", fn conn ->
      json_resp(conn, [Catalog.fixture("webhook")])
    end)

    [listed] = PostShiba.Webhooks.list(client)
    refute Map.has_key?(listed, "secret")

    Bypass.expect(bypass, "GET", "/api/v1/webhook_endpoints/2", fn conn ->
      json_resp(conn, Catalog.fixture("webhook_show"))
    end)

    shown = PostShiba.Webhooks.get(client, 2)
    assert shown["secret"] == "hex-secret"

    Bypass.expect(bypass, "POST", "/api/v1/teams/1/webhook_endpoints", fn conn ->
      json_resp(conn, Catalog.fixture("webhook_show"))
    end)

    created = PostShiba.Webhooks.create(client, Catalog.fixture("webhook_create_request"))
    assert created["secret"] == "hex-secret"

    Bypass.expect(bypass, "PATCH", "/api/v1/webhook_endpoints/2", fn conn ->
      json_resp(conn, Catalog.fixture("webhook"))
    end)

    updated = PostShiba.Webhooks.update(client, 2, Catalog.fixture("webhook_update_request"))
    assert updated == Catalog.fixture("webhook")
    refute Map.has_key?(updated, "secret")
  end

  test "raises when team_id is missing on a team-scoped call" do
    client = PostShiba.new("sk_test")

    err =
      assert_raise PostShiba.Error, fn ->
        PostShiba.Clusters.list(client)
      end

    assert err.error == "missing_team_id"
    assert err.field == "team_id"
    assert err.message =~ "team_id"
  end

  defp contract_cases do
    [
      {"users.me", &PostShiba.Users.me/1, "GET", "/api/v1/users/me", nil,
       Catalog.fixture("whoami")},
      {"emails.send", &PostShiba.Emails.send(&1, Catalog.fixture("email_send_request")), "POST",
       "/api/v1/emails", "email_send_request", Catalog.fixture("email_send_response")},
      {"emails.sendOnCluster",
       &PostShiba.Emails.send_on_cluster(&1, 4, Catalog.fixture("email_send_request")), "POST",
       "/api/v1/teams/1/clusters/4/sends", "email_send_request",
       Catalog.fixture("email_sandbox_response")},
      {"clusters.list", &PostShiba.Clusters.list/1, "GET", "/api/v1/teams/1/clusters", nil,
       [Catalog.fixture("cluster")]},
      {"clusters.get", &PostShiba.Clusters.get(&1, 4), "GET", "/api/v1/clusters/4", nil,
       Catalog.fixture("cluster")},
      {"clusters.create",
       &PostShiba.Clusters.create(&1, Catalog.fixture("cluster_create_request")), "POST",
       "/api/v1/teams/1/clusters", "cluster_create_request", Catalog.fixture("cluster")},
      {"clusters.update",
       &PostShiba.Clusters.update(&1, 4, Catalog.fixture("cluster_update_request")), "PATCH",
       "/api/v1/clusters/4", "cluster_update_request", Catalog.fixture("cluster_updated")},
      {"clusters.suspend", &PostShiba.Clusters.suspend(&1, 4), "POST",
       "/api/v1/clusters/4/suspend", nil, Catalog.fixture("cluster_suspended")},
      {"clusters.resume", &PostShiba.Clusters.resume(&1, 4), "POST", "/api/v1/clusters/4/resume",
       nil, Catalog.fixture("cluster")},
      {"clusters.delete", &PostShiba.Clusters.delete(&1, 4), "DELETE", "/api/v1/clusters/4", nil,
       Catalog.fixture("cluster_deprovisioned")},
      {"sendingDomains.list", &PostShiba.SendingDomains.list/1, "GET",
       "/api/v1/teams/1/sending_domains", nil, [Catalog.fixture("sending_domain")]},
      {"sendingDomains.get", &PostShiba.SendingDomains.get(&1, 8), "GET",
       "/api/v1/sending_domains/8", nil, Catalog.fixture("sending_domain")},
      {"sendingDomains.create",
       &PostShiba.SendingDomains.create(&1, Catalog.fixture("sending_domain_create_request")),
       "POST", "/api/v1/teams/1/sending_domains", "sending_domain_create_request",
       Catalog.fixture("sending_domain")},
      {"sendingDomains.verify", &PostShiba.SendingDomains.verify(&1, 8), "POST",
       "/api/v1/sending_domains/8/verify", nil, Catalog.fixture("sending_domain")},
      {"sendingDomains.suspend", &PostShiba.SendingDomains.suspend(&1, 8), "POST",
       "/api/v1/sending_domains/8/suspend", nil, Catalog.fixture("sending_domain_suspended")},
      {"sendingDomains.resume", &PostShiba.SendingDomains.resume(&1, 8), "POST",
       "/api/v1/sending_domains/8/resume", nil, Catalog.fixture("sending_domain")},
      {"sendingDomains.makePrimary", &PostShiba.SendingDomains.make_primary(&1, 8), "POST",
       "/api/v1/sending_domains/8/make_primary", nil, Catalog.fixture("sending_domain_primary")},
      {"sendingDomains.delete", &PostShiba.SendingDomains.delete(&1, 8), "DELETE",
       "/api/v1/sending_domains/8", nil, Catalog.fixture("empty")},
      {"tenants.list", &PostShiba.Tenants.list/1, "GET", "/api/v1/teams/1/tenants", nil,
       [Catalog.fixture("tenant")]},
      {"tenants.get", &PostShiba.Tenants.get(&1, 12), "GET", "/api/v1/tenants/12", nil,
       Catalog.fixture("tenant")},
      {"tenants.create", &PostShiba.Tenants.create(&1, Catalog.fixture("tenant_create_request")),
       "POST", "/api/v1/teams/1/tenants", "tenant_create_request", Catalog.fixture("tenant")},
      {"tenants.delete", &PostShiba.Tenants.delete(&1, 12), "DELETE", "/api/v1/tenants/12", nil,
       Catalog.fixture("empty")},
      {"inboxes.list", &PostShiba.Inboxes.list/1, "GET", "/api/v1/teams/1/inboxes", nil,
       [Catalog.fixture("inbox_index")]},
      {"inboxes.get", &PostShiba.Inboxes.get(&1, 3), "GET", "/api/v1/inboxes/3", nil,
       Catalog.fixture("inbox")},
      {"inboxes.create", &PostShiba.Inboxes.create(&1, Catalog.fixture("inbox_create_request")),
       "POST", "/api/v1/teams/1/inboxes", "inbox_create_request", Catalog.fixture("inbox")},
      {"inboxes.verify", &PostShiba.Inboxes.verify(&1, 3), "POST", "/api/v1/inboxes/3/verify",
       nil, Catalog.fixture("inbox_index")},
      {"inboxes.delete", &PostShiba.Inboxes.delete(&1, 3), "DELETE", "/api/v1/inboxes/3", nil,
       Catalog.fixture("inbox_index")},
      {"messages.list", &PostShiba.Messages.list(&1, 3), "GET",
       "/api/v1/inboxes/3/inbound_messages", nil, [Catalog.fixture("message")]},
      {"messages.get", &PostShiba.Messages.get(&1, 3, 21), "GET",
       "/api/v1/inboxes/3/inbound_messages/21", nil, Catalog.fixture("message_show")},
      {"events.list", &PostShiba.Events.list(&1, 4), "GET",
       "/api/v1/teams/1/clusters/4/message_events", nil, [Catalog.fixture("event")]},
      {"events.get", &PostShiba.Events.get(&1, 44), "GET", "/api/v1/message_events/44", nil,
       Catalog.fixture("event")},
      {"smtpCredentials.create",
       &PostShiba.SmtpCredentials.create(
         &1,
         4,
         Catalog.fixture("smtp_credential_create_request")
       ), "POST", "/api/v1/teams/1/clusters/4/smtp_credentials", "smtp_credential_create_request",
       Catalog.fixture("smtp_credential_create")},
      {"smtpCredentials.delete", &PostShiba.SmtpCredentials.delete(&1, 4, 9), "DELETE",
       "/api/v1/teams/1/clusters/4/smtp_credentials/9", nil,
       Catalog.fixture("smtp_credential_deleted")},
      {"webhooks.list", &PostShiba.Webhooks.list/1, "GET", "/api/v1/teams/1/webhook_endpoints",
       nil, [Catalog.fixture("webhook")]},
      {"webhooks.get", &PostShiba.Webhooks.get(&1, 2), "GET", "/api/v1/webhook_endpoints/2", nil,
       Catalog.fixture("webhook_show")},
      {"webhooks.create",
       &PostShiba.Webhooks.create(&1, Catalog.fixture("webhook_create_request")), "POST",
       "/api/v1/teams/1/webhook_endpoints", "webhook_create_request",
       Catalog.fixture("webhook_show")},
      {"webhooks.update",
       &PostShiba.Webhooks.update(&1, 2, Catalog.fixture("webhook_update_request")), "PATCH",
       "/api/v1/webhook_endpoints/2", "webhook_update_request", Catalog.fixture("webhook")},
      {"webhooks.delete", &PostShiba.Webhooks.delete(&1, 2), "DELETE",
       "/api/v1/webhook_endpoints/2", nil, Catalog.fixture("empty")},
      {"suppressions.list", &PostShiba.Suppressions.list/1, "GET", "/api/v1/teams/1/suppressions",
       nil, [Catalog.fixture("suppression")]},
      {"suppressions.create",
       &PostShiba.Suppressions.create(&1, Catalog.fixture("suppression_create_request")), "POST",
       "/api/v1/teams/1/suppressions", "suppression_create_request",
       Catalog.fixture("suppression")},
      {"suppressions.delete", &PostShiba.Suppressions.delete(&1, 7), "DELETE",
       "/api/v1/suppressions/7", nil, Catalog.fixture("empty")},
      {"firewall.get", &PostShiba.Firewall.get/1, "GET", "/api/v1/teams/1/firewall", nil,
       Catalog.fixture("firewall")},
      {"firewall.update",
       &PostShiba.Firewall.update(&1, Catalog.fixture("firewall_update_request")), "PATCH",
       "/api/v1/teams/1/firewall", "firewall_update_request", Catalog.fixture("firewall")},
      {"firewall.addEntry",
       &PostShiba.Firewall.add_entry(&1, Catalog.fixture("firewall_entry_create_request")),
       "POST", "/api/v1/teams/1/firewall_entries", "firewall_entry_create_request",
       Catalog.fixture("firewall_entry")},
      {"firewall.deleteEntry", &PostShiba.Firewall.delete_entry(&1, 3), "DELETE",
       "/api/v1/firewall_entries/3", nil, Catalog.fixture("empty")}
    ]
  end

  defp json_resp(conn, body, status \\ 200) do
    conn
    |> Plug.Conn.put_resp_content_type("application/json")
    |> Plug.Conn.resp(status, Jason.encode!(body))
  end

  defp read_json(conn) do
    {:ok, raw, _conn} = Plug.Conn.read_body(conn)
    Jason.decode!(raw)
  end
end
