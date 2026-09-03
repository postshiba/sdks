defmodule PostShiba.Error do
  defexception [:error, :field, :message]

  @impl true
  def message(%__MODULE__{message: message, error: error}) do
    message || error || "request failed"
  end
end
