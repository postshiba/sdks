namespace PostShiba;

public sealed class ApiException : Exception
{
    public string? Error { get; }
    public string? Field { get; }

    public ApiException(string? error, string? field, string? message)
        : base(message ?? "")
    {
        Error = error;
        Field = field;
    }
}
