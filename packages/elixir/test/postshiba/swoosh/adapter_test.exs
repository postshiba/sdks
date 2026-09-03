defmodule PostShiba.Swoosh.AdapterTest do
  use ExUnit.Case, async: true

  alias PostShiba.Swoosh.Adapter
  alias PostShiba.Swoosh.Mapper

  test "maps to, from, subject, html, text, and attachments" do
    email =
      Swoosh.Email.new()
      |> Swoosh.Email.from({"PostShiba", "hello@mail.example.com"})
      |> Swoosh.Email.to("you@example.com")
      |> Swoosh.Email.cc("cc@example.com")
      |> Swoosh.Email.bcc(["bcc@example.com"])
      |> Swoosh.Email.reply_to("hello@mail.example.com")
      |> Swoosh.Email.subject("PostShiba test")
      |> Swoosh.Email.html_body("<p>hello from PostShiba</p>")
      |> Swoosh.Email.text_body("hello from PostShiba")
      |> Swoosh.Email.attachment(%Swoosh.Attachment{
        filename: "photo.png",
        content_type: "image/png",
        data: "abc"
      })

    assert Mapper.to_payload(email) == %{
             "from" => "hello@mail.example.com",
             "to" => ["you@example.com"],
             "cc" => ["cc@example.com"],
             "bcc" => ["bcc@example.com"],
             "reply_to" => "hello@mail.example.com",
             "subject" => "PostShiba test",
             "html" => "<p>hello from PostShiba</p>",
             "text" => "hello from PostShiba",
             "attachments" => [
               %{
                 "filename" => "photo.png",
                 "content_type" => "image/png",
                 "content" => Base.encode64("abc")
               }
             ]
           }
  end

  test "deliver sends the mapped payload through emails.send" do
    bypass = Bypass.open()
    client = PostShiba.new("sk_test", "http://127.0.0.1:#{bypass.port}", 1)

    Bypass.expect(bypass, "POST", "/api/v1/emails", fn conn ->
      body =
        conn
        |> Plug.Conn.read_body()
        |> elem(1)
        |> Jason.decode!()

      assert body["from"] == "hello@mail.example.com"
      assert body["to"] == ["you@example.com"]
      assert body["subject"] == "PostShiba test"
      assert body["html"] == "<p>hello</p>"
      assert body["text"] == "hello"
      assert hd(body["attachments"])["filename"] == "photo.png"

      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.resp(200, Jason.encode!(%{"queued" => true}))
    end)

    email =
      Swoosh.Email.new()
      |> Swoosh.Email.from("hello@mail.example.com")
      |> Swoosh.Email.to("you@example.com")
      |> Swoosh.Email.subject("PostShiba test")
      |> Swoosh.Email.html_body("<p>hello</p>")
      |> Swoosh.Email.text_body("hello")
      |> Swoosh.Email.attachment(%Swoosh.Attachment{
        filename: "photo.png",
        content_type: "image/png",
        data: "abc"
      })

    assert {:ok, %{"queued" => true}} = Adapter.deliver(email, client: client)
  end
end
