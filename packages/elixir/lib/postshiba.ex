defmodule PostShiba do
  @moduledoc """
  HTTP client for the PostShiba API.
  """

  alias PostShiba.Error

  @default_base_url "https://postshiba.com"

  defstruct api_key: nil, base_url: @default_base_url, team_id: nil

  @type t :: %__MODULE__{
          api_key: String.t(),
          base_url: String.t(),
          team_id: term()
        }

  @doc """
  Builds a client. `team_id` is required for team-scoped paths.
  """
  def new(api_key, base_url \\ nil, team_id \\ nil) do
    %__MODULE__{
      api_key: api_key,
      base_url: normalize_base_url(base_url),
      team_id: team_id
    }
  end

  def require_team_id(%__MODULE__{team_id: team_id}) when team_id in [nil, ""] do
    raise Error, error: "missing_team_id", field: "team_id", message: "team_id is required"
  end

  def require_team_id(%__MODULE__{team_id: team_id}), do: team_id

  def request(%__MODULE__{} = client, method, path, opts \\ []) do
    headers =
      [
        {"authorization", "Bearer #{client.api_key}"},
        {"accept", "application/json"}
      ] ++ Keyword.get(opts, :headers, [])

    req_opts = [
      method: method,
      url: client.base_url <> path,
      headers: headers,
      retry: false
    ]

    req_opts =
      case Keyword.get(opts, :body) do
        nil -> req_opts
        body -> Keyword.merge(req_opts, json: body)
      end

    req_opts =
      if opts[:binary] do
        Keyword.put(req_opts, :decode_body, false)
      else
        req_opts
      end

    case Req.request(req_opts) do
      {:ok, %{status: status, body: body}} when status in 200..299 ->
        if opts[:binary], do: body, else: decode_ok(body)

      {:ok, %{body: body}} ->
        raise decode_error(body)

      {:error, exception} ->
        raise exception
    end
  end

  defp normalize_base_url(nil), do: @default_base_url

  defp normalize_base_url(base_url) do
    String.trim_trailing(base_url, "/")
  end

  defp decode_ok(""), do: %{}
  defp decode_ok(body) when is_map(body) or is_list(body), do: body

  defp decode_ok(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> decoded
      {:error, _} -> body
    end
  end

  defp decode_ok(body), do: body

  defp decode_error(body) when is_map(body) do
    %Error{
      error: body["error"],
      field: body["field"],
      message: body["message"]
    }
  end

  defp decode_error(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} when is_map(decoded) -> decode_error(decoded)
      _ -> %Error{error: "error", field: nil, message: body}
    end
  end

  defp decode_error(_body) do
    %Error{error: "error", field: nil, message: "request failed"}
  end

  defmodule Users do
    def me(client), do: PostShiba.request(client, :get, "/api/v1/users/me")
  end

  defmodule Emails do
    def send(client, body) do
      PostShiba.request(client, :post, "/api/v1/emails", body: body)
    end

    def send_on_cluster(client, cluster_id, body, opts \\ []) do
      payload =
        if opts[:sandbox] do
          Map.put(body, "sandbox", true)
        else
          body
        end

      headers =
        case opts[:idempotency_key] do
          nil -> []
          key -> [{"Idempotency-Key", key}]
        end

      path = "/api/v1/teams/#{PostShiba.require_team_id(client)}/clusters/#{cluster_id}/sends"
      PostShiba.request(client, :post, path, body: payload, headers: headers)
    end
  end

  defmodule Clusters do
    def list(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/clusters"
      )
    end

    def get(client, id), do: PostShiba.request(client, :get, "/api/v1/clusters/#{id}")

    def create(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/clusters", body: body)
    end

    def update(client, id, body) do
      PostShiba.request(client, :patch, "/api/v1/clusters/#{id}", body: body)
    end

    def suspend(client, id),
      do: PostShiba.request(client, :post, "/api/v1/clusters/#{id}/suspend")

    def resume(client, id), do: PostShiba.request(client, :post, "/api/v1/clusters/#{id}/resume")
    def delete(client, id), do: PostShiba.request(client, :delete, "/api/v1/clusters/#{id}")
  end

  defmodule SendingDomains do
    def list(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/sending_domains"
      )
    end

    def get(client, id), do: PostShiba.request(client, :get, "/api/v1/sending_domains/#{id}")

    def create(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/sending_domains",
        body: body
      )
    end

    def verify(client, id) do
      PostShiba.request(client, :post, "/api/v1/sending_domains/#{id}/verify")
    end

    def suspend(client, id) do
      PostShiba.request(client, :post, "/api/v1/sending_domains/#{id}/suspend")
    end

    def resume(client, id) do
      PostShiba.request(client, :post, "/api/v1/sending_domains/#{id}/resume")
    end

    def make_primary(client, id) do
      PostShiba.request(client, :post, "/api/v1/sending_domains/#{id}/make_primary")
    end

    def delete(client, id),
      do: PostShiba.request(client, :delete, "/api/v1/sending_domains/#{id}")
  end

  defmodule Tenants do
    def list(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/tenants"
      )
    end

    def get(client, id), do: PostShiba.request(client, :get, "/api/v1/tenants/#{id}")

    def create(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/tenants", body: body)
    end

    def delete(client, id), do: PostShiba.request(client, :delete, "/api/v1/tenants/#{id}")
  end

  defmodule Inboxes do
    def list(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/inboxes"
      )
    end

    def get(client, id), do: PostShiba.request(client, :get, "/api/v1/inboxes/#{id}")

    def create(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/inboxes", body: body)
    end

    def verify(client, id), do: PostShiba.request(client, :post, "/api/v1/inboxes/#{id}/verify")
    def delete(client, id), do: PostShiba.request(client, :delete, "/api/v1/inboxes/#{id}")
  end

  defmodule Messages do
    def list(client, inbox_id) do
      PostShiba.request(client, :get, "/api/v1/inboxes/#{inbox_id}/inbound_messages")
    end

    def get(client, inbox_id, id) do
      PostShiba.request(client, :get, "/api/v1/inboxes/#{inbox_id}/inbound_messages/#{id}")
    end

    def download_attachment(client, inbox_id, id, index) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/inboxes/#{inbox_id}/inbound_messages/#{id}/attachments/#{index}",
        binary: true
      )
    end
  end

  defmodule Events do
    def list(client, cluster_id) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/clusters/#{cluster_id}/message_events"
      )
    end

    def get(client, id), do: PostShiba.request(client, :get, "/api/v1/message_events/#{id}")
  end

  defmodule SmtpCredentials do
    def create(client, cluster_id, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/clusters/#{cluster_id}/smtp_credentials",
        body: body
      )
    end

    def delete(client, cluster_id, id) do
      PostShiba.request(
        client,
        :delete,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/clusters/#{cluster_id}/smtp_credentials/#{id}"
      )
    end
  end

  defmodule Webhooks do
    def list(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/webhook_endpoints"
      )
    end

    def get(client, id), do: PostShiba.request(client, :get, "/api/v1/webhook_endpoints/#{id}")

    def create(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/webhook_endpoints",
        body: body
      )
    end

    def verify(raw_body, timestamp, signature, secret) do
      given = signature |> to_string() |> String.replace_prefix("sha256=", "")

      expected =
        :crypto.mac(:hmac, :sha256, to_string(secret), "#{timestamp}.#{raw_body}")
        |> Base.encode16(case: :lower)

      secure_compare(expected, given)
    end

    defp secure_compare(left, right) when byte_size(left) == byte_size(right) do
      :crypto.hash_equals(left, right)
    end

    defp secure_compare(_left, _right), do: false
  end

  defmodule Suppressions do
    def list(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/suppressions"
      )
    end

    def create(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/suppressions",
        body: body
      )
    end

    def delete(client, id), do: PostShiba.request(client, :delete, "/api/v1/suppressions/#{id}")
  end

  defmodule Firewall do
    def get(client) do
      PostShiba.request(
        client,
        :get,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/firewall"
      )
    end

    def update(client, body) do
      PostShiba.request(
        client,
        :patch,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/firewall", body: body)
    end

    def add_entry(client, body) do
      PostShiba.request(
        client,
        :post,
        "/api/v1/teams/#{PostShiba.require_team_id(client)}/firewall_entries",
        body: body
      )
    end

    def delete_entry(client, id) do
      PostShiba.request(client, :delete, "/api/v1/firewall_entries/#{id}")
    end
  end
end
