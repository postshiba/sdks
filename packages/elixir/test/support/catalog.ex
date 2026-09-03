defmodule PostShiba.Catalog do
  @catalog Path.expand("../../fixtures/catalog", Path.expand("../..", __DIR__))

  def fixture(name) do
    @catalog
    |> Path.join("#{name}.json")
    |> File.read!()
    |> Jason.decode!()
  end
end
