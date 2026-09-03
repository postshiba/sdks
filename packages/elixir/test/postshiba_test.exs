defmodule PostShibaTest do
  use ExUnit.Case, async: true

  alias PostShiba.Catalog

  setup do
    bypass = Bypass.open()
    client = PostShiba.new("sk_test", "http://127.0.0.1:#{bypass.port}", "KjkAJW")
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

      assert Plug.Conn.get_req_header(conn, "x-capsule-cluster-id") == []
      assert read_json(conn) == body
      json_resp(conn, Catalog.fixture("email_send_response"))
    end)

    assert PostShiba.Emails.send(client, body) == Catalog.fixture("email_send_response")
  end

  test "pins emails.send to a cluster", %{bypass: bypass, client: client} do
    body = Catalog.fixture("email_send_request")

    Bypass.expect(bypass, "POST", "/api/v1/emails", fn conn ->
      assert Plug.Conn.get_req_header(conn, "x-capsule-cluster-id") == ["NmQpXr"]
      json_resp(conn, Catalog.fixture("email_send_response"))
    end)

    assert PostShiba.Emails.send(client, body, cluster_id: "NmQpXr") ==
             Catalog.fixture("email_send_response")
  end

  test "sends on a cluster with Idempotency-Key and sandbox", %{bypass: bypass, client: client} do
    body = Catalog.fixture("email_send_request")

    Bypass.expect(bypass, "POST", "/api/v1/teams/KjkAJW/clusters/NmQpXr/sends", fn conn ->
      assert Plug.Conn.get_req_header(conn, "idempotency-key") == ["ikey-1"]
      assert read_json(conn) == Map.put(body, "sandbox", true)
      json_resp(conn, Catalog.fixture("email_sandbox_response"))
    end)

    result =
      PostShiba.Emails.send_on_cluster(client, "NmQpXr", body, idempotency_key: "ikey-1", sandbox: true)

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

    Bypass.expect(bypass, "GET", "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu/attachments/1", fn conn ->
      conn
      |> Plug.Conn.put_resp_content_type("application/octet-stream")
      |> Plug.Conn.resp(200, "png")
    end)

    assert PostShiba.Messages.download_attachment(client, "PqRzMn", "GxTyVu", 1) == "png"
  end

  test "raises 403 and 422 from fixtures", %{bypass: bypass, client: client} do
    Bypass.expect(bypass, "POST", "/api/v1/teams/KjkAJW/clusters", fn conn ->
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
    Bypass.expect(bypass, "POST", "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials", fn conn ->
      json_resp(conn, Catalog.fixture("smtp_credential_create"))
    end)

    created =
      PostShiba.SmtpCredentials.create(
        client,
        "NmQpXr",
        Catalog.fixture("smtp_credential_create_request")
      )

    assert created["password"] == "once-only-password"

    Bypass.expect(bypass, "DELETE", "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq", fn conn ->
      json_resp(conn, Catalog.fixture("smtp_credential_deleted"))
    end)

    deleted = PostShiba.SmtpCredentials.delete(client, "NmQpXr", "RvWsXq")
    refute Map.has_key?(deleted, "password")
  end

  test "omits webhook secret on list and update and returns it on get and create", %{
    bypass: bypass,
    client: client
  } do
    Bypass.expect(bypass, "GET", "/api/v1/teams/KjkAJW/webhook_endpoints", fn conn ->
      json_resp(conn, [Catalog.fixture("webhook")])
    end)

    [listed] = PostShiba.Webhooks.list(client)
    refute Map.has_key?(listed, "secret")

    Bypass.expect(bypass, "GET", "/api/v1/webhook_endpoints/CdFgHj", fn conn ->
      json_resp(conn, Catalog.fixture("webhook_show"))
    end)

    shown = PostShiba.Webhooks.get(client, "CdFgHj")
    assert shown["secret"] == "hex-secret"

    Bypass.expect(bypass, "POST", "/api/v1/teams/KjkAJW/webhook_endpoints", fn conn ->
      json_resp(conn, Catalog.fixture("webhook_show"))
    end)

    created = PostShiba.Webhooks.create(client, Catalog.fixture("webhook_create_request"))
    assert created["secret"] == "hex-secret"

    Bypass.expect(bypass, "PATCH", "/api/v1/webhook_endpoints/CdFgHj", fn conn ->
      json_resp(conn, Catalog.fixture("webhook"))
    end)

    updated = PostShiba.Webhooks.update(client, "CdFgHj", Catalog.fixture("webhook_update_request"))
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
       &PostShiba.Emails.send_on_cluster(&1, "NmQpXr", Catalog.fixture("email_send_request")), "POST",
       "/api/v1/teams/KjkAJW/clusters/NmQpXr/sends", "email_send_request",
       Catalog.fixture("email_sandbox_response")},
      {"clusters.list", &PostShiba.Clusters.list/1, "GET", "/api/v1/teams/KjkAJW/clusters", nil,
       [Catalog.fixture("cluster")]},
      {"clusters.get", &PostShiba.Clusters.get(&1, "NmQpXr"), "GET", "/api/v1/clusters/NmQpXr", nil,
       Catalog.fixture("cluster")},
      {"clusters.create",
       &PostShiba.Clusters.create(&1, Catalog.fixture("cluster_create_request")), "POST",
       "/api/v1/teams/KjkAJW/clusters", "cluster_create_request", Catalog.fixture("cluster")},
      {"clusters.update",
       &PostShiba.Clusters.update(&1, "NmQpXr", Catalog.fixture("cluster_update_request")), "PATCH",
       "/api/v1/clusters/NmQpXr", "cluster_update_request", Catalog.fixture("cluster_updated")},
      {"clusters.suspend", &PostShiba.Clusters.suspend(&1, "NmQpXr"), "POST",
       "/api/v1/clusters/NmQpXr/suspend", nil, Catalog.fixture("cluster_suspended")},
      {"clusters.resume", &PostShiba.Clusters.resume(&1, "NmQpXr"), "POST", "/api/v1/clusters/NmQpXr/resume",
       nil, Catalog.fixture("cluster")},
      {"clusters.delete", &PostShiba.Clusters.delete(&1, "NmQpXr"), "DELETE", "/api/v1/clusters/NmQpXr", nil,
       Catalog.fixture("cluster_deprovisioned")},
      {"sendingDomains.list", &PostShiba.SendingDomains.list/1, "GET",
       "/api/v1/teams/KjkAJW/sending_domains", nil, [Catalog.fixture("sending_domain")]},
      {"sendingDomains.get", &PostShiba.SendingDomains.get(&1, "HsVtYk"), "GET",
       "/api/v1/sending_domains/HsVtYk", nil, Catalog.fixture("sending_domain")},
      {"sendingDomains.create",
       &PostShiba.SendingDomains.create(&1, Catalog.fixture("sending_domain_create_request")),
       "POST", "/api/v1/teams/KjkAJW/sending_domains", "sending_domain_create_request",
       Catalog.fixture("sending_domain")},
      {"sendingDomains.verify", &PostShiba.SendingDomains.verify(&1, "HsVtYk"), "POST",
       "/api/v1/sending_domains/HsVtYk/verify", nil, Catalog.fixture("sending_domain")},
      {"sendingDomains.suspend", &PostShiba.SendingDomains.suspend(&1, "HsVtYk"), "POST",
       "/api/v1/sending_domains/HsVtYk/suspend", nil, Catalog.fixture("sending_domain_suspended")},
      {"sendingDomains.resume", &PostShiba.SendingDomains.resume(&1, "HsVtYk"), "POST",
       "/api/v1/sending_domains/HsVtYk/resume", nil, Catalog.fixture("sending_domain")},
      {"sendingDomains.makePrimary", &PostShiba.SendingDomains.make_primary(&1, "HsVtYk"), "POST",
       "/api/v1/sending_domains/HsVtYk/make_primary", nil, Catalog.fixture("sending_domain_primary")},
      {"sendingDomains.delete", &PostShiba.SendingDomains.delete(&1, "HsVtYk"), "DELETE",
       "/api/v1/sending_domains/HsVtYk", nil, Catalog.fixture("empty")},
      {"tenants.list", &PostShiba.Tenants.list/1, "GET", "/api/v1/teams/KjkAJW/tenants", nil,
       [Catalog.fixture("tenant")]},
      {"tenants.get", &PostShiba.Tenants.get(&1, "WbLcFd"), "GET", "/api/v1/tenants/WbLcFd", nil,
       Catalog.fixture("tenant")},
      {"tenants.create", &PostShiba.Tenants.create(&1, Catalog.fixture("tenant_create_request")),
       "POST", "/api/v1/teams/KjkAJW/tenants", "tenant_create_request", Catalog.fixture("tenant")},
      {"tenants.delete", &PostShiba.Tenants.delete(&1, "WbLcFd"), "DELETE", "/api/v1/tenants/WbLcFd", nil,
       Catalog.fixture("empty")},
      {"inboxes.list", &PostShiba.Inboxes.list/1, "GET", "/api/v1/teams/KjkAJW/inboxes", nil,
       [Catalog.fixture("inbox_index")]},
      {"inboxes.get", &PostShiba.Inboxes.get(&1, "PqRzMn"), "GET", "/api/v1/inboxes/PqRzMn", nil,
       Catalog.fixture("inbox")},
      {"inboxes.create", &PostShiba.Inboxes.create(&1, Catalog.fixture("inbox_create_request")),
       "POST", "/api/v1/teams/KjkAJW/inboxes", "inbox_create_request", Catalog.fixture("inbox")},
      {"inboxes.verify", &PostShiba.Inboxes.verify(&1, "PqRzMn"), "POST", "/api/v1/inboxes/PqRzMn/verify",
       nil, Catalog.fixture("inbox_index")},
      {"inboxes.delete", &PostShiba.Inboxes.delete(&1, "PqRzMn"), "DELETE", "/api/v1/inboxes/PqRzMn", nil,
       Catalog.fixture("inbox_index")},
      {"messages.list", &PostShiba.Messages.list(&1, "PqRzMn"), "GET",
       "/api/v1/inboxes/PqRzMn/inbound_messages", nil, [Catalog.fixture("message")]},
      {"messages.get", &PostShiba.Messages.get(&1, "PqRzMn", "GxTyVu"), "GET",
       "/api/v1/inboxes/PqRzMn/inbound_messages/GxTyVu", nil, Catalog.fixture("message_show")},
      {"events.list", &PostShiba.Events.list(&1, "NmQpXr"), "GET",
       "/api/v1/teams/KjkAJW/clusters/NmQpXr/message_events", nil, [Catalog.fixture("event")]},
      {"events.get", &PostShiba.Events.get(&1, "JkLmNp"), "GET", "/api/v1/message_events/JkLmNp", nil,
       Catalog.fixture("event")},
      {"smtpCredentials.create",
       &PostShiba.SmtpCredentials.create(
         &1,
         "NmQpXr",
         Catalog.fixture("smtp_credential_create_request")
       ), "POST", "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials", "smtp_credential_create_request",
       Catalog.fixture("smtp_credential_create")},
      {"smtpCredentials.delete", &PostShiba.SmtpCredentials.delete(&1, "NmQpXr", "RvWsXq"), "DELETE",
       "/api/v1/teams/KjkAJW/clusters/NmQpXr/smtp_credentials/RvWsXq", nil,
       Catalog.fixture("smtp_credential_deleted")},
      {"webhooks.list", &PostShiba.Webhooks.list/1, "GET", "/api/v1/teams/KjkAJW/webhook_endpoints",
       nil, [Catalog.fixture("webhook")]},
      {"webhooks.get", &PostShiba.Webhooks.get(&1, "CdFgHj"), "GET", "/api/v1/webhook_endpoints/CdFgHj", nil,
       Catalog.fixture("webhook_show")},
      {"webhooks.create",
       &PostShiba.Webhooks.create(&1, Catalog.fixture("webhook_create_request")), "POST",
       "/api/v1/teams/KjkAJW/webhook_endpoints", "webhook_create_request",
       Catalog.fixture("webhook_show")},
      {"webhooks.update",
       &PostShiba.Webhooks.update(&1, "CdFgHj", Catalog.fixture("webhook_update_request")), "PATCH",
       "/api/v1/webhook_endpoints/CdFgHj", "webhook_update_request", Catalog.fixture("webhook")},
      {"webhooks.delete", &PostShiba.Webhooks.delete(&1, "CdFgHj"), "DELETE",
       "/api/v1/webhook_endpoints/CdFgHj", nil, Catalog.fixture("empty")},
      {"suppressions.list", &PostShiba.Suppressions.list/1, "GET", "/api/v1/teams/KjkAJW/suppressions",
       nil, [Catalog.fixture("suppression")]},
      {"suppressions.create",
       &PostShiba.Suppressions.create(&1, Catalog.fixture("suppression_create_request")), "POST",
       "/api/v1/teams/KjkAJW/suppressions", "suppression_create_request",
       Catalog.fixture("suppression")},
      {"suppressions.delete", &PostShiba.Suppressions.delete(&1, "YtReWq"), "DELETE",
       "/api/v1/suppressions/YtReWq", nil, Catalog.fixture("empty")},
      {"firewall.get", &PostShiba.Firewall.get/1, "GET", "/api/v1/teams/KjkAJW/firewall", nil,
       Catalog.fixture("firewall")},
      {"firewall.update",
       &PostShiba.Firewall.update(&1, Catalog.fixture("firewall_update_request")), "PATCH",
       "/api/v1/teams/KjkAJW/firewall", "firewall_update_request", Catalog.fixture("firewall")},
      {"firewall.addEntry",
       &PostShiba.Firewall.add_entry(&1, Catalog.fixture("firewall_entry_create_request")),
       "POST", "/api/v1/teams/KjkAJW/firewall_entries", "firewall_entry_create_request",
       Catalog.fixture("firewall_entry")},
      {"firewall.deleteEntry", &PostShiba.Firewall.delete_entry(&1, "BnMkLo"), "DELETE",
       "/api/v1/firewall_entries/BnMkLo", nil, Catalog.fixture("empty")}
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
