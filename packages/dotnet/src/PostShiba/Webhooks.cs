using System.Security.Cryptography;
using System.Text;

namespace PostShiba;

public static class Webhooks
{
    public static bool Verify(string secret, string timestamp, string signature, string rawBody)
    {
        var provided = signature.StartsWith("sha256=", StringComparison.Ordinal)
            ? signature["sha256=".Length..]
            : signature;

        var payload = Encoding.UTF8.GetBytes($"{timestamp}.{rawBody}");
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var expected = hmac.ComputeHash(payload);

        byte[] actual;
        try
        {
            actual = Convert.FromHexString(provided);
        }
        catch (FormatException)
        {
            return false;
        }

        if (actual.Length != expected.Length)
            return false;

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
