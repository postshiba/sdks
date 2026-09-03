if Code.ensure_loaded?(Swoosh.Adapter) do
  defmodule PostShiba.Swoosh.Mapper do
    @moduledoc false

    def to_payload(%Swoosh.Email{} = email) do
      %{}
      |> put_present("from", format_mailbox(email.from))
      |> put_present("to", Enum.map(List.wrap(email.to), &format_mailbox/1))
      |> put_present("cc", Enum.map(List.wrap(email.cc), &format_mailbox/1))
      |> put_present("bcc", Enum.map(List.wrap(email.bcc), &format_mailbox/1))
      |> put_present("reply_to", format_reply_to(email.reply_to))
      |> put_present("subject", email.subject)
      |> put_present("html", email.html_body)
      |> put_present("text", email.text_body)
      |> put_present("headers", email.headers)
      |> put_present("attachments", Enum.map(List.wrap(email.attachments), &format_attachment/1))
    end

    defp format_mailbox(nil), do: nil
    defp format_mailbox({_name, address}), do: address
    defp format_mailbox(address) when is_binary(address), do: address

    defp format_reply_to(nil), do: nil
    defp format_reply_to([]), do: nil
    defp format_reply_to([mailbox | _]), do: format_mailbox(mailbox)
    defp format_reply_to(mailbox), do: format_mailbox(mailbox)

    defp format_attachment(%Swoosh.Attachment{} = attachment) do
      data = attachment_data(attachment)

      %{
        "filename" => attachment.filename,
        "content_type" => attachment.content_type,
        "content" => Base.encode64(data)
      }
    end

    defp attachment_data(%{data: data}) when is_binary(data), do: data

    defp attachment_data(%{path: path}) when is_binary(path) do
      File.read!(path)
    end

    defp put_present(map, _key, nil), do: map
    defp put_present(map, _key, []), do: map
    defp put_present(map, _key, empty) when empty == %{}, do: map
    defp put_present(map, key, value), do: Map.put(map, key, value)
  end

  defmodule PostShiba.Swoosh.Adapter do
    @moduledoc """
    Swoosh adapter that sends through `PostShiba.Emails.send/2`.
    """

    @behaviour Swoosh.Adapter

    def deliver(%Swoosh.Email{} = email, config) do
      client = client!(config)

      {:ok, PostShiba.Emails.send(client, PostShiba.Swoosh.Mapper.to_payload(email))}
    rescue
      error in [PostShiba.Error] -> {:error, error}
    end

    def validate_config(config) do
      if config[:client] || config[:api_key] do
        :ok
      else
        raise ArgumentError, "expected :client or :api_key in Swoosh config"
      end
    end

    defp client!(config) do
      cond do
        client = config[:client] -> client
        api_key = config[:api_key] -> PostShiba.new(api_key, config[:base_url], config[:team_id])
        true -> raise ArgumentError, "expected :client or :api_key in Swoosh config"
      end
    end
  end
end
